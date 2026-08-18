import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, WalletCards, ArrowDownToLine, ArrowUpFromLine, Plus, Trash2, Pencil, Search, LayoutDashboard, Receipt, PieChart, Menu, TrendingUp, TrendingDown, X } from "lucide-react";
import { api, API, Transaction, Summary } from "./api";

const naira = (n:number) => `₦${n.toLocaleString("en-NG",{maximumFractionDigits:0})}`;

function App() {
  const [active,setActive]=useState("Dashboard");
  const [transactions,setTransactions]=useState<Transaction[]>([]);
  const [categories,setCategories]=useState<string[]>([]);
  const [summary,setSummary]=useState<Summary>({income:0,expenses:0,balance:0,transactions:0,categoryTotals:[]});
  const [showForm,setShowForm]=useState(false);
  const [editing,setEditing]=useState<Transaction|null>(null);
  const [query,setQuery]=useState("");
  const [typeFilter,setTypeFilter]=useState("all");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<{id:number; name:string; email:string} | null>(null);
const [authMode, setAuthMode] = useState<"login" | "register">("login");
  async function load() {
    try {
      setError("");
      const [tx, cats, sum] = await Promise.all([api.transactions(),api.categories(),api.summary()]);
      setTransactions(tx); setCategories(cats.map(c=>c.name)); setSummary(sum);
    } catch(e:any) { setError(e.message || "Could not connect to the API."); }
    finally { setLoading(false); }
  }
  async function handleAuth(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();

  const form = new FormData(e.currentTarget);
  const name = String(form.get("name") || "");
  const email = String(form.get("email") || "");
  const password = String(form.get("password") || "");

  try {
    setError("");

    const endpoint =
      authMode === "register"
        ? "/auth/register"
        : "/auth/login";

    const response = await fetch(`${API}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        authMode === "register"
          ? { name, email, password }
          : { email, password }
      ),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Authentication failed");
    }

    localStorage.setItem("sme_token", data.token || "");
    setUser(data.user);

  } catch (e: any) {
    setError(e.message || "Authentication failed");
  }
  }
  function handleLogout() {
  localStorage.removeItem("sme_token");
  setUser(null);
  setAuthMode("login");
  setError("");
  }
  useEffect(() => {
  if (user) load();
}, [user]);

  const filtered = useMemo(()=>transactions
    .filter(t=>typeFilter==="all" || t.type===typeFilter)
    .filter(t=>`${t.description} ${t.category}`.toLowerCase().includes(query.toLowerCase())),[transactions,typeFilter,query]);

  async function save(t:Omit<Transaction,"id">) {
    try {
      if(editing) await api.update(editing.id,t); else await api.create(t);
      setShowForm(false); setEditing(null); await load();
    } catch(e:any) { alert(e.message || "Could not save transaction."); }
  }
  async function remove(id:string) {
    if(!confirm("Delete this transaction?")) return;
    try { await api.remove(id); await load(); } catch(e:any){alert(e.message);}
  }
if (!user) {
  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleAuth}>
        <div className="brand">
          <div className="brand-mark">₦</div>
          <div>
            <strong>ExpenseTrack</strong>
            <span>SME Finance</span>
          </div>
        </div>

        <h1>{authMode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p>
          {authMode === "login"
            ? "Log in to manage your business finances."
            : "Create an account to start tracking your business finances."}
        </p>

        {authMode === "register" && (
          <label>
            Name
            <input name="name" type="text" required placeholder="Your name" />
          </label>
        )}

        <label>
          Email
          <input name="email" type="email" required placeholder="you@example.com" />
        </label>

        <label>
          Password
          <input
            name="password"
            type="password"
            required
            minLength={6}
            placeholder="At least 6 characters"
          />
        </label>

        {error && <div className="error">{error}</div>}

        <button className="primary wide" type="submit">
          {authMode === "login" ? "Log in" : "Create account"}
        </button>

        <button
          type="button"
          className="text-btn"
          onClick={() => {
            setError("");
            setAuthMode(authMode === "login" ? "register" : "login");
          }}
        >
          {authMode === "login"
            ? "Don't have an account? Create one"
            : "Already have an account? Log in"}
        </button>
      </form>
    </div>
  );
}
  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">₦</div><div><strong>ExpenseTrack</strong><span>SME Finance</span></div></div>
      <nav>{[["Dashboard",LayoutDashboard],["Transactions",Receipt],["Reports",PieChart]].map(([label,Icon]:any)=>
        <button className={active===label?"nav active":"nav"} onClick={()=>setActive(label)} key={label}><Icon size={19}/>{label}</button>)}</nav>
      <div className="side-note"><strong>Built for Nigerian SMEs</strong><span>Track your business money in ₦.</span></div>
    </aside>

    <main className="main">
      <header className="topbar">
        <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)}
>
  <Menu size={22} />
</button>
        <div><p className="eyebrow">Business Finance</p><h1>{active}</h1></div>
        <button className="primary" onClick={()=>{setEditing(null);setShowForm(true)}}><Plus size={18}/> Add transaction</button>
        <button className="logout-btn" onClick={handleLogout}>
  Log out
</button>
      </header>
{menuOpen && (
  <div className="mobile-menu-panel">
    <button onClick={() => {
      setEditing(null);
      setShowForm(true);
      setMenuOpen(false);
    }}>
      <Plus size={18} /> Add New Transaction
    </button>

    <button onClick={() => {
      setActive("Dashboard");
      setMenuOpen(false);
    }}>
      <LayoutDashboard size={18} /> Dashboard
    </button>

    <button onClick={() => {
      setActive("Transactions");
      setMenuOpen(false);
    }}>
      <Receipt size={18} /> Transactions
    </button>

    <button onClick={() => {
      setActive("Reports");
      setMenuOpen(false);
    }}>
      <PieChart size={18} /> Reports
    </button>
  </div>
)}
      {error && <div className="error">Unable to reach the backend: {error}<button onClick={load}>Retry</button></div>}
      {loading ? <div className="panel empty">Loading your business data…</div> : <>
        {active==="Dashboard" && <><section className="cards">
          <Stat title="Total Income" value={naira(summary.income)} icon={<ArrowDownToLine/>} positive/>
          <Stat title="Total Expenses" value={naira(summary.expenses)} icon={<ArrowUpFromLine/>}/>
          <Stat title="Current Balance" value={naira(summary.balance)} icon={<WalletCards/>} balance/>
          <Stat title="Transactions" value={String(summary.transactions)} icon={<BarChart3/>}/>
        </section><section className="grid">
          <div className="panel"><div className="panel-head"><div><h2>Recent transactions</h2><p>Your latest business activity</p></div><button className="text-btn" onClick={()=>setActive("Transactions")}>View all</button></div><TransactionTable items={filtered.slice(0,6)} onEdit={t=>{setEditing(t);setShowForm(true)}} onDelete={remove}/></div>
          <div className="panel"><div className="panel-head"><div><h2>Expense breakdown</h2><p>Current month</p></div></div><Bars items={summary.categoryTotals}/></div>
        </section></>}

        {active==="Transactions" && <section className="panel full"><div className="panel-head"><div><h2>All transactions</h2><p>Search, filter and manage your entries</p></div></div><div className="filters"><div className="search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search description or category"/></div><select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="all">All types</option><option value="income">Income</option><option value="expense">Expense</option></select></div><TransactionTable items={filtered} onEdit={t=>{setEditing(t);setShowForm(true)}} onDelete={remove}/></section>}

        {active==="Reports" && <section className="grid reports"><div className="panel"><div className="panel-head"><div><h2>Monthly expense report</h2><p>Category totals for the current month</p></div></div><div className="report-total"><span>Total expenses</span><strong>{naira(summary.expenses)}</strong></div><Bars items={summary.categoryTotals}/></div><div className="panel insights"><h2>Quick insights</h2><Insight icon={<TrendingUp/>} label="Income" value={naira(summary.income)}/><Insight icon={<TrendingDown/>} label="Expenses" value={naira(summary.expenses)}/><Insight icon={<WalletCards/>} label="Net balance" value={naira(summary.balance)}/></div></section>}

        {active==="Settings" && <section className="panel full settings"><h2>Settings</h2><p>This version uses a PostgreSQL database through the Node.js API.</p><div className="setting-card"><b>Currency</b><span>Nigerian Naira (₦)</span></div><div className="setting-card"><b>Architecture</b><span>React → Express → PostgreSQL</span></div></section>}
      </>}
    </main>

    {showForm && <Modal categories={categories} editing={editing} onClose={()=>{setShowForm(false);setEditing(null)}} onSave={save}/>}
  </div>
}

function Stat({title,value,icon,positive,balance}:{title:string,value:string,icon:React.ReactNode,positive?:boolean,balance?:boolean}) {
  return <div className="stat"><div className={`stat-icon ${positive?"green":balance?"blue":""}`}>{icon}</div><div><span>{title}</span><strong>{value}</strong></div></div>
}
function Bars({items}:{items:{category:string,total:number}[]}) {
  const max=Math.max(...items.map(x=>x.total),1);
  return <div className="bars">{items.length?items.slice(0,8).map(x=><div className="bar-row" key={x.category}><div><span>{x.category}</span><b>{naira(x.total)}</b></div><div className="track"><i style={{width:`${Math.max(6,x.total/max*100)}%`}}/></div></div>):<div className="empty">No expense data available yet.</div>}</div>
}
function Insight({icon,label,value}:{icon:React.ReactNode,label:string,value:string}) {return <div className="insight">{icon}<div><b>{label}</b><span>{value}</span></div></div>}
function TransactionTable({items,onEdit,onDelete}:{items:Transaction[],onEdit:(t:Transaction)=>void,onDelete:(id:string)=>void}) {
  if(!items.length)return <div className="empty">No transactions found.</div>;
  return <div className="table-wrap"><table><thead><tr><th>Description</th><th>Category</th><th>Date</th><th>Amount</th><th></th></tr></thead><tbody>{items.map(t=><tr key={t.id}><td><b>{t.description}</b><small>{t.type}</small></td><td>{t.category}</td><td>{new Date(t.date+"T00:00:00").toLocaleDateString("en-NG",{day:"2-digit",month:"short",year:"numeric"})}</td><td className={t.type==="income"?"money income":"money expense"}>{t.type==="income"?"+":"-"}{naira(t.amount)}</td><td><button className="icon-btn" onClick={()=>onEdit(t)}><Pencil size={16}/></button><button className="icon-btn danger" onClick={()=>onDelete(t.id)}><Trash2 size={16}/></button></td></tr>)}</tbody></table></div>
}
function Modal({editing,categories,onClose,onSave}:{editing:Transaction|null,categories:string[],onClose:()=>void,onSave:(t:Omit<Transaction,"id">)=>void}) {
  const [type,setType]=useState<"income"|"expense">(editing?.type||"expense"),[description,setDescription]=useState(editing?.description||""),[category,setCategory]=useState(editing?.category||categories[0]||"Other"),[amount,setAmount]=useState(editing?.amount?.toString()||""),[date,setDate]=useState(editing?.date||new Date().toISOString().slice(0,10));
  function submit(e:React.FormEvent){e.preventDefault();if(!description.trim()||!amount||Number(amount)<=0)return alert("Enter a description and valid amount.");onSave({type,description:description.trim(),category,amount:Number(amount),date})}
  return <div className="overlay"><form className="modal" onSubmit={submit}><div className="modal-head"><div><h2>{editing?"Edit transaction":"Add transaction"}</h2><p>Record business income or expense.</p></div><button type="button" className="close" onClick={onClose}><X/></button></div><div className="type-switch"><button type="button" className={type==="expense"?"selected":""} onClick={()=>setType("expense")}>Expense</button><button type="button" className={type==="income"?"selected income-tab":""} onClick={()=>setType("income")}>Income</button></div><label>Description<input value={description} onChange={e=>setDescription(e.target.value)} placeholder="e.g. Fuel purchase"/></label><label>Amount (₦)<input type="number" min="1" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="50000"/></label><label>Category<select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>Date<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><button className="primary wide" type="submit">{editing?"Save changes":"Add transaction"}</button></form></div>
}
export default App;
