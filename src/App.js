/* global __firebase_config, __app_id, __initial_auth_token */
import React, { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { Wallet, TrendingUp, TrendingDown, PiggyBank, PlusCircle, Trash2, Loader2, Sparkles, Calendar, Tag, ArrowUpRight, ArrowDownLeft, DatabaseZap, Cloud } from 'lucide-react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, query } from 'firebase/firestore';

// --- Firebase Configuration ---
// ใช้ Config จากระบบหรือใส่ของคุณเองตรงนี้
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBP8IDfuEeAVfIxTih7W9g6tssuyaUrlmM",
  authDomain: "my-finance-tracker-e9696.firebaseapp.com",
  projectId: "my-finance-tracker-e9696",
  storageBucket: "my-finance-tracker-e9696.firebasestorage.app",
  messagingSenderId: "578486265087",
  appId: "1:578486265087:web:4001b2059d3a561e4ed8ca",
  measurementId: "G-V6Z3S8W8CY"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : "personal-finance-ledger-v1";

const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6'];

export default function App() {
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [form, setForm] = useState({ 
    type: 'expense', 
    category: 'ค่าอาหาร-เครื่องดื่ม', 
    amount: '', 
    date: new Date().toISOString().split('T')[0] 
  });

  const categories = {
    income: ['เงินเดือน', 'โบนัส', 'เงินปันผล', 'รับจ้างอิสระ', 'อื่นๆ'],
    expense: ['ค่าอาหาร-เครื่องดื่ม', 'ค่าเดินทาง', 'ช้อปปิ้ง', 'ค่าที่พัก', 'สุขภาพ', 'บันเทิง', 'อื่นๆ'],
    saving: ['เงินออมฉุกเฉิน', 'ลงทุนหุ้น/กองทุน', 'ประกันชีวิต', 'เกษียณอายุ']
  };

  // Inject Tailwind via CDN
  useEffect(() => {
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script');
      script.id = 'tailwind-cdn';
      script.src = 'https://cdn.tailwindcss.com';
      document.head.appendChild(script);
    }
  }, []);

  // Auth Effect - FIXED: Improved error handling for custom token
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          try {
            await signInWithCustomToken(auth, __initial_auth_token);
          } catch (tokenErr) {
            console.error("Custom Token Error, falling back to anonymous:", tokenErr);
            await signInAnonymously(auth);
          }
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Critical Auth Error:", err);
        setError("ไม่สามารถเชื่อมต่อระบบยืนยันตัวตนได้ กรุณารีเฟรชหน้าจอ");
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setLoading(false);
        setError(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Firestore Real-time Listener
  useEffect(() => {
    if (!user) return;

    // Path ตามกฎ: /artifacts/{appId}/users/{userId}/{collectionName}
    const txRef = collection(db, 'artifacts', appId, 'users', user.uid, 'transactions');
    
    const unsubscribe = onSnapshot(txRef, (snapshot) => {
      const data = snapshot.docs.map(d => ({ 
        id: d.id, 
        ...d.data() 
      }));
      // เรียงลำดับตามวันที่ในเครื่อง
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(data);
    }, (err) => {
      console.error("Firestore Read Error:", err);
      // Only show error if it's not a permission error during initial load
      if (err.code !== 'permission-denied') {
        setError("เกิดข้อผิดพลาดในการดึงข้อมูลจาก Cloud");
      }
    });

    return () => unsubscribe();
  }, [user]);

  const stats = useMemo(() => {
    const inc = transactions.filter(t => t.type === 'income').reduce((a, b) => a + (Number(b.amount) || 0), 0);
    const exp = transactions.filter(t => t.type === 'expense').reduce((a, b) => a + (Number(b.amount) || 0), 0);
    const sav = transactions.filter(t => t.type === 'saving').reduce((a, b) => a + (Number(b.amount) || 0), 0);
    return { inc, exp, sav, bal: inc - exp - sav };
  }, [transactions]);

  const chartData = useMemo(() => {
    const res = transactions.filter(t => t.type === 'expense').reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + (Number(t.amount) || 0);
      return acc;
    }, {});
    return Object.entries(res).map(([name, value]) => ({ name, value }));
  }, [transactions]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || !user) return;

    try {
      const txRef = collection(db, 'artifacts', appId, 'users', user.uid, 'transactions');
      await addDoc(txRef, {
        ...form,
        amount: parseFloat(form.amount),
        createdAt: serverTimestamp()
      });
      setForm({ ...form, amount: '' });
    } catch (err) {
      console.error("Cloud Save Error:", err);
      setError("บันทึกข้อมูลไม่สำเร็จ");
    }
  };

  const handleDelete = async (id) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', id);
      await deleteDoc(docRef);
    } catch (err) {
      console.error("Cloud Delete Error:", err);
      setError("ลบข้อมูลไม่สำเร็จ");
    }
  };

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
      <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Connecting to Cloud...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-slate-900 p-4 lg:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Cloud Status Indicator */}
        <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex items-center justify-between mb-4 shadow-sm">
          <div className="flex items-center gap-3 text-indigo-700">
            <Cloud size={20} className="animate-pulse" />
            <span className="text-xs font-black uppercase tracking-wider italic text-indigo-600">Cloud Sync Active</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-indigo-500 uppercase px-3 py-1 bg-white rounded-full border border-indigo-200">
              User: {user?.uid.substring(0, 8)}...
            </span>
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-center gap-3 text-rose-600 animate-bounce">
            <DatabaseZap size={20} />
            <span className="text-xs font-bold uppercase">{error}</span>
          </div>
        )}

        <header className="flex flex-col md:flex-row justify-between items-center bg-white p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 gap-4">
          <div className="flex items-center gap-5">
            <div className="bg-indigo-600 p-4 rounded-[1.5rem] text-white shadow-xl rotate-3">
              <Wallet size={32} />
            </div>
            <div>
              <h1 className="text-2xl font-black italic tracking-tighter uppercase leading-none text-slate-800">Financial Ledger</h1>
              <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.2em] mt-1">Cloud Integrated Analytics</p>
            </div>
          </div>
          <div className="px-6 py-2 bg-slate-50 rounded-full text-[10px] font-black text-slate-400 uppercase border border-slate-100 flex items-center gap-2">
            ID: <span className="text-slate-800 truncate max-w-[100px]">{user?.uid}</span>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'ยอดคงเหลือปัจจุบัน', val: stats.bal, icon: Wallet, color: 'text-slate-900', bg: 'bg-white' },
            { label: 'รายรับเดือนนี้', val: stats.inc, icon: TrendingUp, color: 'text-white', bg: 'bg-indigo-600' },
            { label: 'รายจ่ายเดือนนี้', val: stats.exp, icon: TrendingDown, color: 'text-white', bg: 'bg-rose-500' },
            { label: 'เงินออมสุทธิ', val: stats.sav, icon: PiggyBank, color: 'text-white', bg: 'bg-emerald-500' }
          ].map((c, i) => (
            <div key={i} className={`${c.bg} p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-between h-44 hover:translate-y-[-4px] transition-all duration-300`}>
              <div className={`flex justify-between items-start ${c.color === 'text-white' ? 'opacity-70' : 'text-slate-300'}`}>
                <span className="text-[10px] font-black uppercase tracking-widest">{c.label}</span>
                <c.icon size={18} />
              </div>
              <h3 className={`text-3xl font-black ${c.color}`}>฿{c.val.toLocaleString()}</h3>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <h2 className="text-lg font-black uppercase italic mb-8 flex items-center gap-3 text-slate-800">
              <PlusCircle className="text-indigo-600" size={24} /> เพิ่มรายการใหม่
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex p-1.5 bg-slate-50 rounded-2xl gap-1 border border-slate-100">
                {['income', 'expense', 'saving'].map((t) => (
                  <button key={t} type="button" onClick={() => setForm({...form, type: t, category: categories[t][0]})}
                    className={`flex-1 py-3 text-[10px] font-black rounded-xl transition-all uppercase ${form.type === t ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>
                    {t === 'income' ? 'รายรับ' : t === 'expense' ? 'รายจ่าย' : 'เงินออม'}
                  </button>
                ))}
              </div>

              <div className="space-y-5">
                <div className="relative group">
                   <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
                   <select 
                    value={form.category} 
                    onChange={(e) => setForm({...form, category: e.target.value})}
                    className="w-full pl-12 pr-5 py-4 bg-slate-50 rounded-2xl focus:ring-2 ring-indigo-100 outline-none font-bold text-sm appearance-none cursor-pointer border border-transparent focus:border-indigo-200 transition-all"
                   >
                     {categories[form.type].map(cat => <option key={cat} value={cat}>{cat}</option>)}
                   </select>
                </div>

                <div className="relative group">
                   <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-xl text-slate-300 group-focus-within:text-indigo-500">฿</span>
                   <input 
                    type="number" 
                    value={form.amount} 
                    onChange={(e) => setForm({...form, amount: e.target.value})} 
                    placeholder="0.00"
                    className="w-full pl-12 pr-5 py-5 bg-slate-50 rounded-2xl focus:ring-2 ring-indigo-100 outline-none font-black text-2xl text-indigo-600 border border-transparent focus:border-indigo-200" 
                    required 
                   />
                </div>

                <div className="relative group">
                   <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                   <input 
                    type="date" 
                    value={form.date} 
                    onChange={(e) => setForm({...form, date: e.target.value})}
                    className="w-full pl-12 pr-5 py-4 bg-slate-50 rounded-2xl focus:ring-2 ring-indigo-100 outline-none font-bold text-sm border border-transparent focus:border-indigo-200" 
                    required 
                   />
                </div>
              </div>

              <button type="submit" className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-black transition-all uppercase tracking-[0.2em] text-xs">
                บันทึกไปยังคลาวด์
              </button>
            </form>
          </section>

          <section className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 min-h-[450px] flex flex-col">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-lg font-black uppercase italic flex items-center gap-3 text-slate-800">
                <Sparkles className="text-indigo-600" /> สัดส่วนค่าใช้จ่าย
              </h2>
              <div className="text-[10px] font-black text-slate-400 bg-slate-50 px-4 py-2 rounded-xl">ข้อมูลล่าสุดแบบ Real-time</div>
            </div>
            
            <div className="flex-1">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={chartData} 
                      innerRadius={90} 
                      outerRadius={120} 
                      paddingAngle={10} 
                      dataKey="value" 
                      stroke="none"
                      animationDuration={1200}
                    >
                      {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', padding: '1.2rem'}} 
                      itemStyle={{fontWeight: '900', textTransform: 'uppercase', fontSize: '12px'}}
                    />
                    <Legend verticalAlign="bottom" align="center" iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-200 space-y-4">
                   <div className="p-10 bg-slate-50 rounded-full border-2 border-dashed border-slate-100">
                     <PieChart size={64} className="opacity-20" />
                   </div>
                   <p className="font-black uppercase tracking-widest text-[10px]">ยังไม่มีข้อมูลวิเคราะห์</p>
                </div>
              )}
            </div>
          </section>
        </div>

        <section className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/20">
            <h2 className="font-black text-xl uppercase italic tracking-tight text-slate-800">ประวัติธุรกรรม</h2>
            <div className="bg-white px-4 py-2 rounded-xl border border-slate-100 text-[10px] font-black text-indigo-600">
              TOTAL ENTRIES: {transactions.length}
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-50">
                <tr>
                  <th className="px-10 py-6">วันที่</th>
                  <th className="px-10 py-6">หมวดหมู่</th>
                  <th className="px-10 py-6 text-right">จำนวนเงิน (บาท)</th>
                  <th className="px-10 py-6 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="group hover:bg-slate-50/40 transition-colors">
                    <td className="px-10 py-8 text-xs font-bold text-slate-400 tracking-tighter">{tx.date}</td>
                    <td className="px-10 py-8">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${tx.type === 'income' ? 'bg-indigo-50 text-indigo-500' : tx.type === 'expense' ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>
                          {tx.type === 'income' ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                        </div>
                        <span className="font-black text-sm uppercase italic tracking-tighter text-slate-700">{tx.category}</span>
                      </div>
                    </td>
                    <td className={`px-10 py-8 text-right font-black text-2xl tracking-tighter ${tx.type === 'income' ? 'text-indigo-600' : tx.type === 'expense' ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {tx.type === 'income' ? '+' : '-'}{tx.amount.toLocaleString()}
                    </td>
                    <td className="px-10 py-8 text-center">
                      <button 
                        onClick={() => handleDelete(tx.id)} 
                        className="p-3 text-slate-200 hover:text-rose-500 hover:bg-rose-50 transition-all rounded-2xl active:scale-90"
                      >
                        <Trash2 size={20} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {transactions.length === 0 && (
              <div className="py-24 text-center">
                <p className="text-slate-300 font-black uppercase tracking-[0.3em] text-[10px] italic">ไม่มีข้อมูลในขณะนี้ • เริ่มเพิ่มรายการแรกได้เลย</p>
              </div>
            )}
          </div>
        </section>
      </div>
      
      <footer className="mt-16 text-center pb-12">
        <div className="inline-block px-8 py-4 bg-slate-100 rounded-full">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Cloud Security Enabled • Data Encrypted</p>
        </div>
      </footer>
    </div>
  );
}