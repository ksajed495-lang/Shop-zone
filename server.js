require("dotenv").config();
const express=require("express"), cors=require("cors"), cookieParser=require("cookie-parser");
const bcrypt=require("bcryptjs"), jwt=require("jsonwebtoken"), {Pool}=require("pg");
const app=express();
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL?.includes("localhost")?false:{rejectUnauthorized:false}});
app.use(cors({origin:process.env.FRONTEND_ORIGIN||true,credentials:true}));
app.use(express.json({limit:"1mb"})); app.use(cookieParser());
app.use(express.static("public"));

const sign=u=>jwt.sign({id:u.id,role:u.role,email:u.email},process.env.JWT_SECRET,{expiresIn:"7d"});
function auth(req,res,next){try{const t=req.cookies.token||req.headers.authorization?.replace("Bearer ","");if(!t)throw 0;req.user=jwt.verify(t,process.env.JWT_SECRET);next()}catch(e){res.status(401).json({error:"ورود لازم است"})}}
function admin(req,res,next){if(req.user?.role!=="admin")return res.status(403).json({error:"دسترسی ادمین لازم است"});next()}
const slug=s=>s.toString().trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g,"-").replace(/^-|-$/g,"");

app.get("/api/products",async(req,res)=>{const {rows}=await pool.query("SELECT * FROM products WHERE active=true ORDER BY id DESC");res.json(rows)});
app.post("/api/register",async(req,res)=>{try{let{name,email,password}=req.body;if(!name||!email||!password||password.length<8)return res.status(400).json({error:"نام، ایمیل و رمز حداقل ۸ کاراکتری لازم است"});email=email.toLowerCase().trim();const h=await bcrypt.hash(password,12);const r=await pool.query("INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email,role",[name,email,h]);res.cookie("token",sign(r.rows[0]),{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:604800000});res.json(r.rows[0])}catch(e){res.status(400).json({error:e.code==="23505"?"ایمیل قبلاً ثبت شده است":"ثبت‌نام ناموفق بود"})}});
app.post("/api/login",async(req,res)=>{const email=(req.body.email||"").toLowerCase().trim();const r=await pool.query("SELECT * FROM users WHERE email=$1",[email]);if(!r.rows[0]||!(await bcrypt.compare(req.body.password||"",r.rows[0].password_hash)))return res.status(401).json({error:"ایمیل یا رمز نادرست است"});const u=r.rows[0];res.cookie("token",sign(u),{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:604800000});res.json({id:u.id,name:u.name,email:u.email,role:u.role})});
app.post("/api/logout",(req,res)=>{res.clearCookie("token");res.json({ok:true})});
app.get("/api/me",auth,(req,res)=>res.json(req.user));

app.post("/api/orders",auth,async(req,res)=>{const {items,customer_name,phone,address}=req.body;if(!Array.isArray(items)||!items.length)return res.status(400).json({error:"سبد خرید خالی است"});const ids=items.map(x=>Number(x.product_id));const client=await pool.connect();try{await client.query("BEGIN");const {rows:p}=await client.query("SELECT * FROM products WHERE id=ANY($1) AND active=true FOR UPDATE",[ids]);let total=0,lines=[];for(const i of items){const x=p.find(z=>z.id===Number(i.product_id)),q=Number(i.quantity);if(!x||q<1||q>x.stock)throw new Error("موجودی کالا کافی نیست");total+=x.price_afn*q;lines.push([x,q])}const o=await client.query("INSERT INTO orders(user_id,customer_name,phone,address,total_afn) VALUES($1,$2,$3,$4,$5) RETURNING *",[req.user.id,customer_name,phone,address,total]);for(const [x,q] of lines){await client.query("INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price_afn) VALUES($1,$2,$3,$4,$5)",[o.rows[0].id,x.id,x.name,q,x.price_afn]);await client.query("UPDATE products SET stock=stock-$1,updated_at=NOW() WHERE id=$2",[q,x.id])}await client.query("COMMIT");res.json(o.rows[0])}catch(e){await client.query("ROLLBACK");res.status(400).json({error:e.message})}finally{client.release()}});

app.get("/api/my-orders",auth,async(req,res)=>{const {rows}=await pool.query("SELECT * FROM orders WHERE user_id=$1 ORDER BY id DESC",[req.user.id]);res.json(rows)});

/* Payment adapter:
   The exact API contract is provider-specific. Credentials belong in environment variables.
   This endpoint deliberately refuses to pretend a payment succeeded when no provider is configured. */
app.post("/api/payments/create",auth,async(req,res)=>{const {order_id}=req.body;const o=(await pool.query("SELECT * FROM orders WHERE id=$1 AND user_id=$2",[order_id,req.user.id])).rows[0];if(!o)return res.status(404).json({error:"سفارش پیدا نشد"});if(!process.env.PAYMENT_API_URL)return res.status(503).json({error:"درگاه پرداخت هنوز تنظیم نشده است. PAYMENT_API_URL و کلیدهای درگاه را در محیط سرور تنظیم کنید."});res.status(501).json({error:"آداپتور درگاه آماده است اما قرارداد API ارائه‌دهنده باید مطابق مستندات رسمی آن پیاده‌سازی شود."})});
app.post("/api/payments/webhook",async(req,res)=>{ // verify signature here according to provider documentation
  if(!process.env.PAYMENT_WEBHOOK_SECRET)return res.status(503).send("Webhook secret not configured");
  const {order_id,status,payment_ref}=req.body;
  if(status==="paid")await pool.query("UPDATE orders SET payment_status='paid',payment_ref=$1 WHERE id=$2",[payment_ref||null,order_id]);
  res.json({ok:true});
});

/* Admin */
app.get("/api/admin/dashboard",auth,admin,async(req,res)=>{const [p,o,u,s]=await Promise.all([
pool.query("SELECT count(*)::int n FROM products WHERE active=true"),
pool.query("SELECT count(*)::int n,COALESCE(sum(total_afn),0)::int total FROM orders"),
pool.query("SELECT count(*)::int n FROM users"),
pool.query("SELECT count(*)::int n FROM orders WHERE status='pending'")]);res.json({products:p.rows[0].n,orders:o.rows[0].n,revenue:o.rows[0].total,users:u.rows[0].n,pending:s.rows[0].n})});
app.post("/api/admin/products",auth,admin,async(req,res)=>{const {name,category,description="",price_afn,stock=0,image_url=""}=req.body;if(!name||!category||Number(price_afn)<0)return res.status(400).json({error:"اطلاعات کالا ناقص است"});const s=slug(name)+"-"+Date.now();const r=await pool.query("INSERT INTO products(name,slug,category,description,price_afn,stock,image_url) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",[name,s,category,description,price_afn,stock,image_url]);res.json(r.rows[0])});
app.put("/api/admin/products/:id",auth,admin,async(req,res)=>{const {name,category,description,price_afn,stock,image_url,active}=req.body;const r=await pool.query("UPDATE products SET name=$1,category=$2,description=$3,price_afn=$4,stock=$5,image_url=$6,active=$7,updated_at=NOW() WHERE id=$8 RETURNING *",[name,category,description,price_afn,stock,image_url,active,req.params.id]);res.json(r.rows[0])});
app.delete("/api/admin/products/:id",auth,admin,async(req,res)=>{await pool.query("UPDATE products SET active=false WHERE id=$1",[req.params.id]);res.json({ok:true})});
app.get("/api/admin/orders",auth,admin,async(req,res)=>{const {rows}=await pool.query("SELECT * FROM orders ORDER BY id DESC");res.json(rows)});
app.patch("/api/admin/orders/:id",auth,admin,async(req,res)=>{const {status,payment_status}=req.body;const r=await pool.query("UPDATE orders SET status=COALESCE($1,status),payment_status=COALESCE($2,payment_status) WHERE id=$3 RETURNING *",[status,payment_status,req.params.id]);res.json(r.rows[0])});

app.get("*",(req,res)=>res.sendFile(require("path").join(__dirname,"public","index.html")));
(async()=>{try{await pool.query("SELECT 1");console.log("Database connected")}catch(e){console.error("Database connection failed:",e.message)}app.listen(process.env.PORT||3000,()=>console.log("Afghan Shop running"))})();
