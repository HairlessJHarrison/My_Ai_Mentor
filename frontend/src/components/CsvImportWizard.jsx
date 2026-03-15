import { useState, useEffect } from 'react';
import { get, post } from '../hooks/useApi';

export default function CsvImportWizard({ onClose, onImported }) {
    const [step, setStep] = useState(1);
    const [file, setFile] = useState(null);
    const [mappings, setMappings] = useState([]);
    const [selectedMapping, setSelectedMapping] = useState(null);
    const [newMapping, setNewMapping] = useState({
        profile_name: '', date_column: '', amount_column: '', description_column: '', category_column: '',
        skip_rows: 0, negate_amounts: false,
    });
    const [creatingMapping, setCreatingMapping] = useState(false);
    const [preview, setPreview] = useState(null);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        get('/budgets/csv-mappings').then(setMappings).catch(console.error);
    }, []);

    const handleFileSelect = (e) => {
        setFile(e.target.files[0]);
        setStep(2);
    };

    const saveMapping = async () => {
        try {
            const m = await post('/budgets/csv-mappings', {
                ...newMapping,
                household_id: 'default',
                skip_rows: parseInt(newMapping.skip_rows),
            });
            setMappings(prev => [...prev, m]);
            setSelectedMapping(m.id);
            setCreatingMapping(false);
        } catch (err) { alert(err.message); }
    };

    const runPreview = async () => {
        if (!file || !selectedMapping) return;
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await post(`/budgets/import-csv/preview?mapping_id=${selectedMapping}`, formData);
            setPreview(res);
            setStep(3);
        } catch (err) { alert(err.message); }
        finally { setLoading(false); }
    };

    const runImport = async () => {
        if (!file || !selectedMapping) return;
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await post(`/budgets/import-csv?mapping_id=${selectedMapping}`, formData);
            setResult(res);
            setStep(4);
            if (onImported) onImported();
        } catch (err) { alert(err.message); }
        finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-surface-800 rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl border border-surface-700/50 max-h-[80vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}>

                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-surface-100">Import CSV</h2>
                    <button onClick={onClose} className="text-surface-400 hover:text-surface-200 text-lg w-11 h-11 flex items-center justify-center rounded-xl hover:bg-surface-700 active:scale-[0.95]">&times;</button>
                </div>

                {/* Step indicators */}
                <div className="flex gap-2 mb-6">
                    {[1, 2, 3, 4].map(s => (
                        <div key={s} className={`flex-1 h-1 rounded-full ${s <= step ? 'bg-forest-500' : 'bg-surface-700'}`} />
                    ))}
                </div>

                {/* Step 1: Upload */}
                {step === 1 && (
                    <div className="text-center py-8">
                        <p className="text-surface-300 mb-4">Select a CSV file to import transactions</p>
                        <label className="inline-block px-6 py-3 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium cursor-pointer transition-colors">
                            Choose File
                            <input type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />
                        </label>
                    </div>
                )}

                {/* Step 2: Mapping */}
                {step === 2 && (
                    <div className="space-y-4">
                        <p className="text-sm text-surface-300">File: <span className="text-surface-100">{file?.name}</span></p>

                        {mappings.length > 0 && !creatingMapping && (
                            <div>
                                <p className="text-sm text-surface-400 mb-2">Select a saved mapping:</p>
                                <div className="space-y-2">
                                    {mappings.map(m => (
                                        <button key={m.id} onClick={() => setSelectedMapping(m.id)}
                                            className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-colors ${selectedMapping === m.id
                                                ? 'bg-forest-600 text-white'
                                                : 'bg-surface-700 text-surface-300 hover:bg-surface-600'
                                            }`}>
                                            {m.profile_name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button onClick={() => setCreatingMapping(!creatingMapping)}
                            className="text-sm text-forest-400 hover:text-forest-300">
                            {creatingMapping ? 'Use existing mapping' : '+ Create new mapping'}
                        </button>

                        {creatingMapping && (
                            <div className="space-y-3">
                                <input type="text" value={newMapping.profile_name}
                                    onChange={e => setNewMapping(m => ({ ...m, profile_name: e.target.value }))}
                                    placeholder="Mapping name" className="w-full bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                                <div className="grid grid-cols-2 gap-3">
                                    <input type="text" value={newMapping.date_column}
                                        onChange={e => setNewMapping(m => ({ ...m, date_column: e.target.value }))}
                                        placeholder="Date column" className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                                    <input type="text" value={newMapping.amount_column}
                                        onChange={e => setNewMapping(m => ({ ...m, amount_column: e.target.value }))}
                                        placeholder="Amount column" className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                                    <input type="text" value={newMapping.description_column}
                                        onChange={e => setNewMapping(m => ({ ...m, description_column: e.target.value }))}
                                        placeholder="Description column" className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                                    <input type="text" value={newMapping.category_column}
                                        onChange={e => setNewMapping(m => ({ ...m, category_column: e.target.value }))}
                                        placeholder="Category column (optional)" className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                                </div>
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 text-sm text-surface-300">
                                        <input type="number" value={newMapping.skip_rows}
                                            onChange={e => setNewMapping(m => ({ ...m, skip_rows: e.target.value }))}
                                            min="0" className="w-20 bg-surface-700 text-surface-100 rounded-lg px-3 py-2 text-sm outline-none min-h-[44px]" />
                                        Skip rows
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-surface-300">
                                        <input type="checkbox" checked={newMapping.negate_amounts}
                                            onChange={e => setNewMapping(m => ({ ...m, negate_amounts: e.target.checked }))}
                                            className="rounded" />
                                        Negate amounts
                                    </label>
                                </div>
                                <button onClick={saveMapping}
                                    className="w-full py-2.5 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium transition-colors min-h-[44px] active:scale-[0.97]">
                                    Save Mapping
                                </button>
                            </div>
                        )}

                        <div className="flex gap-3 justify-end pt-2">
                            <button onClick={() => setStep(1)} className="px-4 py-2.5 bg-surface-700 text-surface-300 rounded-xl text-sm min-h-[44px] active:scale-[0.97]">Back</button>
                            <button onClick={runPreview} disabled={!selectedMapping || loading}
                                className="px-4 py-2.5 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 min-h-[44px] active:scale-[0.97]">
                                {loading ? 'Loading...' : 'Preview'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Preview */}
                {step === 3 && preview && (
                    <div className="space-y-4">
                        <p className="text-sm text-surface-300">{preview.rows?.length || 0} transactions found</p>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-surface-400 text-left">
                                        <th className="pb-2 pr-4">Date</th>
                                        <th className="pb-2 pr-4">Description</th>
                                        <th className="pb-2 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(preview.rows || []).slice(0, 5).map((row, i) => (
                                        <tr key={i} className="border-t border-surface-700/50">
                                            <td className="py-3 pr-4 text-surface-300">{row.date}</td>
                                            <td className="py-3 pr-4 text-surface-200 truncate max-w-[200px]">{row.description}</td>
                                            <td className={`py-3 text-right font-medium ${row.amount < 0 ? 'text-rose-400' : 'text-forest-400'}`}>
                                                ${Math.abs(row.amount).toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {(preview.rows?.length || 0) > 5 && (
                            <p className="text-xs text-surface-500">...and {preview.rows.length - 5} more</p>
                        )}
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setStep(2)} className="px-4 py-2.5 bg-surface-700 text-surface-300 rounded-xl text-sm min-h-[44px] active:scale-[0.97]">Back</button>
                            <button onClick={runImport} disabled={loading}
                                className="px-4 py-2.5 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 min-h-[44px] active:scale-[0.97]">
                                {loading ? 'Importing...' : 'Import All'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 4: Result */}
                {step === 4 && result && (
                    <div className="text-center py-6">
                        <p className="text-3xl mb-2">✅</p>
                        <p className="text-lg font-semibold text-surface-100 mb-2">Import Complete</p>
                        <p className="text-sm text-surface-300 mb-1">{result.imported || 0} transactions imported</p>
                        {result.skipped > 0 && <p className="text-xs text-surface-400">{result.skipped} skipped</p>}
                        {result.errors > 0 && <p className="text-xs text-rose-400">{result.errors} errors</p>}
                        <button onClick={onClose}
                            className="mt-6 px-6 py-2.5 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium transition-colors min-h-[44px] active:scale-[0.97]">
                            Done
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
