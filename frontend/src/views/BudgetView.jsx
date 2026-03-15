import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post } from '../hooks/useApi';
import CsvImportWizard from '../components/CsvImportWizard';

export default function BudgetView() {
    const navigate = useNavigate();
    const [summary, setSummary] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [showCsvWizard, setShowCsvWizard] = useState(false);
    const [form, setForm] = useState({
        date: new Date().toISOString().slice(0, 10), amount: '',
        description: '', category: 'other', household_id: 'default',
    });

    useEffect(() => {
        Promise.all([
            get('/budgets/summary?month=current'),
            get('/budgets/transactions?month=current'),
        ]).then(([s, t]) => { setSummary(s); setTransactions(t); })
            .catch(console.error).finally(() => setLoading(false));
    }, []);

    const createTransaction = async (e) => {
        e.preventDefault();
        try {
            await post('/budgets/transactions', {
                ...form,
                amount: parseFloat(form.amount),
            });
            const [s, t] = await Promise.all([
                get('/budgets/summary?month=current'),
                get('/budgets/transactions?month=current'),
            ]);
            setSummary(s); setTransactions(t);
            setShowForm(false);
            setForm({ date: new Date().toISOString().slice(0, 10), amount: '', description: '', category: 'other', household_id: 'default' });
        } catch (err) { alert(err.message); }
    };

    const categories = ['groceries', 'dining', 'transport', 'utilities', 'entertainment', 'health', 'housing', 'other'];

    return (
        <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/')} className="text-surface-400 hover:text-surface-200 p-2 -ml-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl active:scale-[0.97]">&larr;</button>
                    <h1 className="text-2xl font-bold text-surface-100">💰 Budget</h1>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowCsvWizard(true)}
                        className="px-4 py-2.5 bg-surface-700 hover:bg-surface-600 text-surface-200 rounded-xl text-sm font-medium transition-colors min-h-[44px] active:scale-[0.97]">
                        Import CSV
                    </button>
                    <button onClick={() => setShowForm(!showForm)}
                        className="px-4 py-2.5 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium transition-colors min-h-[44px] active:scale-[0.97]">
                        + Log Transaction
                    </button>
                </div>
            </div>

            {showForm && (
                <form onSubmit={createTransaction} className="bg-surface-800 rounded-2xl p-6 mb-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            placeholder="Description" required
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-forest-500" />
                        <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                            placeholder="Amount (negative = expense)" step="0.01" required
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                        <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none">
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                            className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                    </div>
                    <div className="flex gap-3 justify-end">
                        <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 bg-surface-700 text-surface-300 rounded-xl text-sm min-h-[44px] active:scale-[0.97]">Cancel</button>
                        <button type="submit" className="px-4 py-2.5 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium min-h-[44px] active:scale-[0.97]">Log</button>
                    </div>
                </form>
            )}

            {loading ? (
                <div className="text-center py-12 text-surface-400">Loading budget...</div>
            ) : (
                <>
                    {/* Category breakdown */}
                    {summary?.categories?.length > 0 && (
                        <div className="bg-surface-800 rounded-2xl p-6 mb-6">
                            <h2 className="text-lg font-semibold text-surface-100 mb-4">Category Breakdown</h2>
                            <div className="space-y-3">
                                {summary.categories.map((cat, i) => (
                                    <div key={i}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-surface-200 capitalize">{cat.category}</span>
                                            <span className="text-surface-400">${cat.spent?.toFixed(0)} / ${cat.limit?.toFixed(0) || '—'}</span>
                                        </div>
                                        <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${cat.pct_used > 90 ? 'bg-rose-500' : cat.pct_used > 70 ? 'bg-amber-500' : 'bg-ocean-400'}`}
                                                style={{ width: `${Math.min(cat.pct_used, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 pt-4 border-t border-surface-700 flex justify-between font-medium text-sm">
                                <span className="text-surface-200">Total Spent</span>
                                <span className="text-amber-300">${summary.total_spent?.toFixed(2)}</span>
                            </div>
                        </div>
                    )}

                    {/* Transactions */}
                    <h2 className="text-lg font-semibold text-surface-100 mb-3">Recent Transactions</h2>
                    <div className="space-y-2">
                        {transactions.length === 0 ? (
                            <div className="text-center py-8 text-surface-400">No transactions this month</div>
                        ) : transactions.map((t, i) => (
                            <div key={t.id || i} className="flex items-center justify-between px-4 py-4 bg-surface-800 rounded-xl text-sm">
                                <div>
                                    <p className="text-surface-100">{t.description}</p>
                                    <p className="text-sm text-surface-400">{t.date} · <span className="capitalize">{t.category}</span></p>
                                </div>
                                <span className={`font-medium ${t.amount < 0 ? 'text-rose-400' : 'text-forest-400'}`}>
                                    {t.amount < 0 ? '-' : '+'}${Math.abs(t.amount).toFixed(2)}
                                </span>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {showCsvWizard && (
                <CsvImportWizard
                    onClose={() => setShowCsvWizard(false)}
                    onImported={async () => {
                        const [s, t] = await Promise.all([
                            get('/budgets/summary?month=current'),
                            get('/budgets/transactions?month=current'),
                        ]);
                        setSummary(s); setTransactions(t);
                    }}
                />
            )}
        </div>
    );
}
