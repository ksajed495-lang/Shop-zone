require("dotenv").config();
const bcrypt=require("bcryptjs"),{Pool}=require("pg"),fs=require("fs");
(async()=>{const p=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL?.includes("localhost")?false:{rejectUnauthorized:false}});
await p.query(fs.readFileSync("schema.sql","utf8"));
const email=process.env.ADMIN_EMAIL||"admin@afghanshop.af", pass=process.env.ADMIN_PASSWORD;
if(!pass) throw new Error("Set ADMIN_PASSWORD in .env before creating admin.");
const h=await bcrypt.hash(pass,12);
await p.query(`INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'admin')
ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash,role='admin'`,["Afghan Shop Admin",email,h]);
const n=await p.query("SELECT count(*)::int FROM products");if(n.rows[0].count===0){
const products=[["سرویس قابلمه","وسایل خانه",2450,20],["جاروبرقی خانگی","وسایل خانه",5200,10],["چراغ LED","لوازم برقی",850,30],["هدفون بی‌سیم","موبایل و دیجیتال",1650,15],["کوله پشتی","پوشاک و لوازم",1200,20]];
for(const x of products)await p.query("INSERT INTO products(name,slug,category,price_afn,stock) VALUES($1,$2,$3,$4,$5)",[x[0],x[0].replace(/\s+/g,"-")+Date.now()+Math.random(),x[1],x[2],x[3]])}
await p.end();console.log("Database initialized and admin created:",email)})().catch(e=>{console.error(e);process.exit(1)});
