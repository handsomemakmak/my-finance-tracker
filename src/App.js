import React, { useState, useEffect, useMemo } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend 
} from 'recharts';
import { 
  Wallet, TrendingDown, PlusCircle, Trash2, AlertCircle, LogIn, LogOut, User, Lock, RefreshCcw, Edit3, X, Download, Calendar as CalendarIcon, ChevronLeft, ChevronRight
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signOut 
} from 'firebase/auth';
import { 
  getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, updateDoc
} from 'firebase/firestore';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyBP8IDfuEeAVfIxTih7W9g6tssuyaUrlmM",
  authDomain: "my-finance-tracker-e9696.firebaseapp.com",
  projectId: "my-finance-tracker-e9696",
  storageBucket: "my-finance-tracker-e9696.firebasestorage.app",
  messagingSenderId: "578486265087",
  appId: "1:578486265087:web:4001b2059d3a561e4ed8ca",
  measurementId: "G-V6Z3S8W8CY"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "my-finance-app"; 

const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

function LoginView({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    if (username === 'handsomemakmak' && password === '!Handsomemakmak23') {
      onLoginSuccess();
    } else {
      setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="bg-white p-10 rounded-[3rem] shadow-2xl w-full max-w-md border border-slate-100">
        <div className="text-center mb-12">
          <div className="bg-blue-600 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-100 transform rotate-3">
            <Wallet className="text-white" size={40} />
          </div>
          <h1 className="text-3xl font-black italic text-slate-900 tracking-tighter uppercase">FINANCE HUB</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Administrator Access</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="relative">
            <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
            <input type="text" placeholder="Username" className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-transparent rounded-[1.5rem] focus:border-blue-500 focus:bg-white outline-none font-bold transition-all" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div className="relative">
            <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
            <input type="password" placeholder="Password" className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-transparent rounded-[1.5rem] focus:border-blue-500 focus:bg-white outline-none font-bold transition-all" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl text-xs font-bold flex items-center"><AlertCircle size={16} className="mr-2" /> {error}</div>}
          <button type="submit" className="w-full bg-slate-900 hover:bg-black text-white font-black py-5 rounded-[1.5rem] transition-all shadow-xl flex items-center justify-center space-x-3 group">
            <span>SIGN IN</span>
            <LogIn size={20} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewDate, setViewDate] = useState(new Date());
  const [editingId, setEditingId] = useState(null);

  const [type, setType] = useState('expense');
  const [category, setCategory] = useState('ค่าอาหาร-เครื่องดื่ม');
  const [subCategory, setSubCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const categories = useMemo(() => ({
    income: ['เงินเดือน', 'เงิน Affiliate', 'อื่นๆ (ระบุ)'],
    expense: ['ค่าอาหาร-เครื่องดื่ม', 'ค่าเดินทาง(น้ำมัน)', 'สิ่งของฟุ่มเฟือย', 'อื่นๆ'],
    saving: ['สะสมฉุกเฉิน', 'เงินออม', 'ลงทุน (คริปโต)', 'ลงทุน (หุ้น/กองทุน)']
  }), []);

  useEffect(() => {
    const savedAuth = sessionStorage.getItem('is_admin_logged_in');
    if (savedAuth === 'true') setIsAuthorized(true);
    
    const initAuth = async () => {
      try { await signInAnonymously(auth); } catch (err) { setLoading(false); }
    };
    initAuth();

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user || !isAuthorized) return;
    const transactionsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'transactions');
    const unsubscribeData = onSnapshot(transactionsRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(data);
      setLoading(false);
    }, (err) => {
      console.error("Firestore Error:", err);
      setLoading(false);
    });
    return () => unsubscribeData();
  }, [user, isAuthorized]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear();
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, viewDate]);

  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const calendar = [];
    for (let i = 0; i < firstDay; i++) calendar.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayTxs = transactions.filter(t => t.date === dateStr);
      const inc = dayTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const exp = dayTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      calendar.push({ day: d, income: inc, expense: exp });
    }
    return calendar;
  }, [transactions, viewDate]);

  const handleLoginSuccess = () => {
    setIsAuthorized(true);
    sessionStorage.setItem('is_admin_logged_in', 'true');
  };

  const handleLogout = () => {
    setIsAuthorized(false);
    sessionStorage.removeItem('is_admin_logged_in');
    signOut(auth);
  };

  const resetForm = () => {
    setEditingId(null);
    setAmount('');
    setSubCategory('');
    setDate(new Date().toISOString().split('T')[0]);
    setType('expense');
    setCategory(categories['expense'][0]);
  };

  const startEdit = (tx) => {
    setEditingId(tx.id);
    setType(tx.type);
    setCategory(tx.category);
    setSubCategory(tx.subCategory || '');
    setAmount(tx.amount.toString());
    setDate(tx.date);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user || !amount) return;
    try {
      const data = {
        type, category,
        subCategory: (category === 'อื่นๆ (ระบุ)' || category.includes('ลงทุน')) ? subCategory : '',
        amount: parseFloat(amount),
        date, 
        updatedAt: serverTimestamp()
      };
      if (editingId) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', editingId), data);
      } else {
        const transactionsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'transactions');
        await addDoc(transactionsRef, { ...data, createdAt: serverTimestamp() });
      }
      resetForm();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', id));
      if (editingId === id) resetForm();
    } catch (err) { console.error(err); }
  };

  const exportToCSV = () => {
    if (filteredTransactions.length === 0) return;
    const headers = ["Date", "Type", "Category", "SubCategory", "Amount"];
    const rows = filteredTransactions.map(t => [t.date, t.type, t.category, t.subCategory || '', t.amount]);
    let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `finance_report_${viewDate.getFullYear()}_${viewDate.getMonth() + 1}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalIncome = filteredTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = filteredTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const totalSaving = filteredTransactions.filter(t => t.type === 'saving').reduce((sum, t) => sum + t.amount, 0);
  const balance = totalIncome - totalExpense - totalSaving;

  const expenseChartData = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, curr) => {
      const existing = acc.find(item => item.name === curr.category);
      if (existing) existing.value += curr.amount;
      else acc.push({ name: curr.category, value: curr.amount });
      return acc;
    }, []);

  const changeMonth = (offset) => {
    const newDate = new Date(viewDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setViewDate(newDate);
  };

  if (!isAuthorized) return <LoginView onLoginSuccess={handleLoginSuccess} />;
  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50"><RefreshCcw className="animate-spin text-blue-600" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-100 transform rotate-3">
              <Wallet className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-black italic tracking-tighter uppercase">FINANCE HUB</h1>
              <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Admin Control</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
             <div className="hidden md:flex items-center bg-slate-50 rounded-2xl p-1 px-3 space-x-3">
                <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white rounded-xl transition-all"><ChevronLeft size={16}/></button>
                <span className="text-[10px] font-black uppercase tracking-widest min-w-[100px] text-center">
                  {viewDate.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={() => changeMonth(1)} className="p-2 hover:bg-white rounded-xl transition-all"><ChevronRight size={16}/></button>
             </div>
             <button onClick={handleLogout} className="flex items-center space-x-2 text-slate-400 hover:text-rose-500 px-2 py-2 font-black text-xs transition-colors uppercase tracking-widest">
               <LogOut size={18} />
             </button>
          </div>
        </div>

        {/* Calendar Summary */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-black flex items-center text-slate-800 uppercase tracking-tight italic">
              <CalendarIcon className="mr-3 text-blue-600" size={20} />
              Monthly Calendar
            </h2>
            <div className="flex md:hidden items-center bg-slate-50 rounded-2xl p-1 px-2">
                <button onClick={() => changeMonth(-1)} className="p-1"><ChevronLeft size={14}/></button>
                <span className="text-[8px] font-black uppercase tracking-widest mx-2">
                  {viewDate.toLocaleDateString('th-TH', { month: 'short' })}
                </span>
                <button onClick={() => changeMonth(1)} className="p-1"><ChevronRight size={14}/></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 md:gap-2">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
              <div key={d} className="text-center text-[10px] font-black text-slate-300 py-2">{d}</div>
            ))}
            {calendarDays.map((dayData, idx) => (
              <div key={idx} className={`min-h-[60px] md:min-h-[80px] p-1 md:p-2 rounded-2xl border ${dayData ? 'bg-slate-50 border-transparent hover:border-blue-100 transition-all' : 'bg-transparent border-transparent'}`}>
                {dayData && (
                  <>
                    <span className="text-[10px] font-black text-slate-400">{dayData.day}</span>
                    <div className="mt-1 space-y-0.5">
                      {dayData.income > 0 && <div className="text-[8px] md:text-[9px] font-black text-emerald-500 truncate">+{dayData.income.toLocaleString()}</div>}
                      {dayData.expense > 0 && <div className="text-[8px] md:text-[9px] font-black text-rose-500 truncate">-{dayData.expense.toLocaleString()}</div>}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">NET BALANCE ({viewDate.getMonth() + 1})</p>
            <h3 className={`text-3xl font-black ${balance >= 0 ? 'text-slate-900' : 'text-rose-500'}`}>฿{balance.toLocaleString()}</h3>
          </div>
          <div className="bg-emerald-500 p-8 rounded-[2.5rem] text-white shadow-xl shadow-emerald-100">
            <p className="text-[10px] font-black opacity-80 uppercase mb-2 tracking-widest">INCOME</p>
            <h3 className="text-3xl font-black">฿{totalIncome.toLocaleString()}</h3>
          </div>
          <div className="bg-rose-500 p-8 rounded-[2.5rem] text-white shadow-xl shadow-rose-100">
            <p className="text-[10px] font-black opacity-80 uppercase mb-2 tracking-widest">EXPENSE</p>
            <h3 className="text-3xl font-black">฿{totalExpense.toLocaleString()}</h3>
          </div>
          <div className="bg-indigo-500 p-8 rounded-[2.5rem] text-white shadow-xl shadow-indigo-100">
            <p className="text-[10px] font-black opacity-80 uppercase mb-2 tracking-widest">SAVINGS</p>
            <h3 className="text-3xl font-black">฿{totalSaving.toLocaleString()}</h3>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className={`p-8 rounded-[2.5rem] shadow-sm border transition-all h-fit ${editingId ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100'}`}>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-lg font-black flex items-center text-slate-800 uppercase tracking-tight">
                {editingId ? <Edit3 className="mr-3 text-blue-600" size={24} /> : <PlusCircle className="mr-3 text-blue-600" size={24} />}
                {editingId ? 'EDIT ENTRY' : 'NEW ENTRY'}
              </h2>
              {editingId && <button onClick={resetForm} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>}
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className={`flex p-1.5 rounded-[1.5rem] ${editingId ? 'bg-blue-100/50' : 'bg-slate-50'}`}>
                {['income', 'expense', 'saving'].map((t) => (
                  <button key={t} type="button" onClick={() => { setType(t); setCategory(categories[t][0]); }} className={`flex-1 py-3 text-[10px] font-black rounded-2xl transition-all uppercase tracking-widest ${type === t ? 'bg-white shadow-md text-blue-600' : 'text-slate-400'}`}>
                    {t === 'income' ? 'รับ' : t === 'expense' ? 'จ่าย' : 'ออม'}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-1 tracking-widest">CATEGORY</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full p-5 bg-white border-none rounded-2xl outline-none font-bold text-sm shadow-sm">
                  {categories[type].map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              {(category === 'อื่นๆ (ระบุ)' || category.includes('ลงทุน')) && (
                <div className="animate-in fade-in slide-in-from-top-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-1 tracking-widest">DETAIL</label>
                  <input type="text" value={subCategory} onChange={(e) => setSubCategory(e.target.value)} placeholder="ระบุเพิ่มเติม..." className="w-full p-5 bg-white border-none rounded-2xl outline-none font-bold text-sm shadow-sm" required />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-1 tracking-widest">AMOUNT</label>
                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full p-5 bg-white border-none rounded-2xl outline-none font-black text-blue-600 text-lg shadow-sm" placeholder="0" required />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-1 tracking-widest">DATE</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-5 bg-white border-none rounded-2xl outline-none text-xs font-bold shadow-sm" required />
                </div>
              </div>
              <button type="submit" className={`w-full text-white font-black py-5 rounded-2xl transition-all shadow-xl uppercase tracking-widest ${editingId ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-100' : 'bg-slate-900 hover:bg-black shadow-slate-200'}`}>
                {editingId ? 'UPDATE RECORD' : 'SAVE RECORD'}
              </button>
            </form>
          </div>

          {/* Analytics */}
          <div className="lg:col-span-2 bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col min-h-[450px]">
            <h2 className="text-xl font-black text-slate-800 mb-10 uppercase tracking-tight italic">MONTHLY ANALYSIS</h2>
            <div className="flex-1 flex items-center justify-center">
              {expenseChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie data={expenseChartData} cx="50%" cy="50%" innerRadius={90} outerRadius={125} paddingAngle={8} dataKey="value" strokeWidth={0}>
                      {expenseChartData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <RechartsTooltip contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', padding: '15px' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontWeight: 'bold', fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-slate-200">
                  <TrendingDown size={60} className="mx-auto mb-4" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">NO DATA FOR THIS MONTH</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* History List */}
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-10 border-b border-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
            <h2 className="font-black text-xl tracking-tighter text-slate-800 uppercase italic">Monthly History</h2>
            <div className="flex items-center space-x-3">
              <button 
                onClick={exportToCSV}
                disabled={filteredTransactions.length === 0}
                className={`flex items-center space-x-2 px-6 py-3 rounded-2xl font-black text-[10px] tracking-widest transition-all ${filteredTransactions.length > 0 ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' : 'bg-slate-50 text-slate-300 cursor-not-allowed'}`}
              >
                <Download size={16} />
                <span>EXPORT REPORT</span>
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                <tr>
                  <th className="px-10 py-6">Date</th>
                  <th className="px-10 py-6">Category</th>
                  <th className="px-10 py-6 text-right">Amount</th>
                  <th className="px-10 py-6 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className={`hover:bg-slate-50/50 transition-colors group ${editingId === tx.id ? 'bg-blue-50/50' : ''}`}>
                    <td className="px-10 py-8 text-xs font-bold text-slate-400">{new Date(tx.date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })}</td>
                    <td className="px-10 py-8">
                      <div className="flex items-center space-x-4">
                        <div className={`w-3 h-3 rounded-full ${tx.type === 'income' ? 'bg-emerald-500' : tx.type === 'expense' ? 'bg-rose-500' : 'bg-indigo-500'}`}></div>
                        <div>
                           <div className="font-black text-slate-800 text-sm tracking-tight">{tx.category}</div>
                           {tx.subCategory && <div className="text-[10px] text-blue-600 font-black uppercase mt-1 bg-blue-50 px-2 py-0.5 rounded-md inline-block tracking-widest">{tx.subCategory}</div>}
                        </div>
                      </div>
                    </td>
                    <td className={`px-10 py-8 text-right font-black text-xl ${tx.type === 'income' ? 'text-emerald-500' : tx.type === 'expense' ? 'text-rose-500' : 'text-indigo-500'}`}>
                      {tx.type === 'income' ? '+' : '-'}{tx.amount.toLocaleString()}
                    </td>
                    <td className="px-10 py-8">
                      <div className="flex items-center justify-center space-x-2">
                        <button onClick={() => startEdit(tx)} className="text-slate-300 hover:text-blue-500 transition-all p-3 hover:bg-blue-50 rounded-2xl"><Edit3 size={18} /></button>
                        <button onClick={() => handleDelete(tx.id)} className="text-slate-300 hover:text-rose-500 transition-all p-3 hover:bg-rose-50 rounded-2xl"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredTransactions.length === 0 && <div className="p-24 text-center"><p className="text-slate-300 font-black uppercase tracking-[0.4em] text-[10px]">No History for this Month</p></div>}
          </div>
        </div>
      </div>
    </div>
  );
}