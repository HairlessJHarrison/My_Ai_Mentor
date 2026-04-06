import { useState, useMemo } from 'react';

const CHORE_COLUMNS = [
  { key: 'title', label: 'Name', type: 'string' },
  { key: 'category', label: 'Category', type: 'string' },
  { key: 'points', label: 'Points', type: 'number' },
  { key: 'frequency', label: 'Frequency', type: 'string' },
];

const MEAL_COLUMNS = [
  { key: 'recipe_name', label: 'Recipe', type: 'string' },
  { key: 'meal_type', label: 'Type', type: 'string' },
  { key: 'est_cost', label: 'Cost', type: 'number' },
  { key: 'health_score', label: 'Health', type: 'number' },
  { key: 'prep_time_min', label: 'Prep (min)', type: 'number' },
];

const FREQUENCIES = ['daily', 'weekly', 'as_needed'];
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function PresetBrowser({ type, presets, members, onAdd, onClose }) {
  const [sortField, setSortField] = useState(type === 'chore' ? 'title' : 'recipe_name');
  const [sortDir, setSortDir] = useState('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [addedIds, setAddedIds] = useState(new Set());
  const [adding, setAdding] = useState(false);

  const columns = type === 'chore' ? CHORE_COLUMNS : MEAL_COLUMNS;
  const nameField = type === 'chore' ? 'title' : 'recipe_name';

  const sorted = useMemo(() => {
    const list = presets.filter(p =>
      p[nameField].toLowerCase().includes(searchQuery.toLowerCase())
    );
    list.sort((a, b) => {
      const va = a[sortField];
      const vb = b[sortField];
      const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [presets, sortField, sortDir, searchQuery, nameField]);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const startEdit = (preset) => {
    setEditingId(preset.id);
    setEditForm({
      ...preset,
      assigned_member_ids: [],
      date: new Date().toISOString().slice(0, 10),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const toggleMemberAssignment = (memberId) => {
    setEditForm(f => {
      const ids = f.assigned_member_ids.includes(memberId)
        ? f.assigned_member_ids.filter(id => id !== memberId)
        : [...f.assigned_member_ids, memberId];
      return { ...f, assigned_member_ids: ids };
    });
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sorted.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sorted.map(p => p.id)));
    }
  };

  const addSingle = async (preset) => {
    setAdding(true);
    try {
      await onAdd(preset);
      setAddedIds(prev => new Set(prev).add(preset.id));
      if (editingId === preset.id) cancelEdit();
    } catch (err) {
      alert(err.message);
    }
    setAdding(false);
  };

  const addFromEdit = async () => {
    setAdding(true);
    try {
      await onAdd(editForm);
      setAddedIds(prev => new Set(prev).add(editForm.id));
      cancelEdit();
    } catch (err) {
      alert(err.message);
    }
    setAdding(false);
  };

  const bulkAdd = async () => {
    setAdding(true);
    for (const id of selectedIds) {
      const preset = presets.find(p => p.id === id);
      if (preset && !addedIds.has(id)) {
        try {
          await onAdd(preset);
          setAddedIds(prev => new Set(prev).add(id));
        } catch (err) {
          console.error(`Failed to add ${preset[nameField]}:`, err);
        }
      }
    }
    setSelectedIds(new Set());
    setAdding(false);
  };

  const formatCell = (col, value) => {
    if (col.key === 'est_cost') return `$${value.toFixed(2)}`;
    if (col.key === 'health_score') return `${value}/10`;
    if (col.key === 'frequency') return value.replace(/_/g, ' ');
    return value;
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface-800 rounded-2xl p-6 max-w-4xl w-full mx-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-surface-100">
            {type === 'chore' ? '🧹 Chore Presets' : '🍽️ Meal Presets'}
          </h2>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-200 text-lg w-11 h-11 flex items-center justify-center rounded-xl hover:bg-surface-700 active:scale-[0.95]">✕</button>
        </div>

        {/* Search */}
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={`Search ${type === 'chore' ? 'chores' : 'meals'}...`}
          className="w-full bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none mb-4 focus:ring-2 focus:ring-forest-500"
        />

        {/* Scrollable list */}
        <div className="overflow-y-auto flex-1 -mx-2 px-2">
          {/* Column headers */}
          <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-surface-400 border-b border-surface-700 sticky top-0 bg-surface-800 z-10">
            <div className="w-8 flex-shrink-0">
              <input type="checkbox" checked={selectedIds.size === sorted.length && sorted.length > 0}
                onChange={toggleSelectAll}
                className="accent-forest-500 w-5 h-5" />
            </div>
            {columns.map(col => (
              <button key={col.key}
                onClick={() => toggleSort(col.key)}
                className={`flex-1 text-left hover:text-surface-200 transition-colors flex items-center gap-1 ${
                  col.key === nameField ? 'flex-[2]' : ''
                }`}>
                {col.label}
                {sortField === col.key && (
                  <span className="text-forest-400">{sortDir === 'asc' ? '▲' : '▼'}</span>
                )}
              </button>
            ))}
            <div className="w-20 flex-shrink-0 text-right">Actions</div>
          </div>

          {/* Rows */}
          {sorted.map(preset => (
            <div key={preset.id}>
              <div className={`flex items-center gap-2 px-3 py-3.5 text-sm rounded-xl transition-colors ${
                addedIds.has(preset.id)
                  ? 'bg-forest-600/10 text-surface-400'
                  : editingId === preset.id
                    ? 'bg-surface-700/50'
                    : 'hover:bg-surface-700/30'
              }`}>
                <div className="w-8 flex-shrink-0">
                  <input type="checkbox"
                    checked={selectedIds.has(preset.id)}
                    onChange={() => toggleSelect(preset.id)}
                    className="accent-forest-500 w-5 h-5" />
                </div>
                {columns.map(col => (
                  <div key={col.key}
                    className={`flex-1 ${col.key === nameField ? 'flex-[2] font-medium text-surface-100' : 'text-surface-300'} ${
                      addedIds.has(preset.id) ? 'line-through text-surface-500' : ''
                    }`}>
                    {formatCell(col, preset[col.key])}
                  </div>
                ))}
                <div className="w-20 flex-shrink-0 flex justify-end gap-1">
                  {addedIds.has(preset.id) ? (
                    <span className="text-xs text-forest-400 font-medium">Added</span>
                  ) : (
                    <>
                      <button onClick={() => editingId === preset.id ? cancelEdit() : startEdit(preset)}
                        className="px-3 py-2.5 text-sm text-surface-400 hover:text-surface-200 transition-colors min-h-[48px] active:scale-[0.97]"
                        title="Edit before adding">
                        ✏️
                      </button>
                      <button onClick={() => addSingle(preset)}
                        disabled={adding}
                        className="px-3 py-2.5 text-sm bg-forest-600 hover:bg-forest-500 text-white rounded-lg transition-colors disabled:opacity-50 min-h-[48px] active:scale-[0.97]">
                        Add
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Inline edit form */}
              {editingId === preset.id && (
                <div className="bg-surface-700/40 rounded-xl p-4 mx-3 mb-2 space-y-3">
                  {type === 'chore' ? (
                    <>
                      <input type="text" value={editForm.title}
                        onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                        placeholder="Chore name"
                        className="w-full bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-surface-400 mb-1">Points</label>
                          <input type="number" value={editForm.points}
                            onChange={e => setEditForm(f => ({ ...f, points: parseInt(e.target.value) || 0 }))}
                            min="1"
                            className="w-full bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs text-surface-400 mb-1">Frequency</label>
                          <select value={editForm.frequency}
                            onChange={e => setEditForm(f => ({ ...f, frequency: e.target.value }))}
                            className="w-full bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none">
                            {FREQUENCIES.map(f => <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>)}
                          </select>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input type="text" value={editForm.recipe_name}
                          onChange={e => setEditForm(f => ({ ...f, recipe_name: e.target.value }))}
                          placeholder="Recipe name"
                          className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                        <select value={editForm.meal_type}
                          onChange={e => setEditForm(f => ({ ...f, meal_type: e.target.value }))}
                          className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none">
                          {MEAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <input type="date" value={editForm.date}
                          onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                          className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                        <input type="text"
                          value={Array.isArray(editForm.ingredients) ? editForm.ingredients.join(', ') : editForm.ingredients}
                          onChange={e => setEditForm(f => ({ ...f, ingredients: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                          placeholder="Ingredients (comma separated)"
                          className="bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                        <div>
                          <label className="block text-xs text-surface-400 mb-1">Est. Cost ($)</label>
                          <input type="number" value={editForm.est_cost}
                            onChange={e => setEditForm(f => ({ ...f, est_cost: parseFloat(e.target.value) || 0 }))}
                            step="0.01"
                            className="w-full bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-surface-400 mb-1">Health (1-10)</label>
                            <input type="number" value={editForm.health_score}
                              onChange={e => setEditForm(f => ({ ...f, health_score: parseInt(e.target.value) || 1 }))}
                              min="1" max="10"
                              className="w-full bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                          </div>
                          <div>
                            <label className="block text-xs text-surface-400 mb-1">Prep (min)</label>
                            <input type="number" value={editForm.prep_time_min}
                              onChange={e => setEditForm(f => ({ ...f, prep_time_min: parseInt(e.target.value) || 0 }))}
                              className="w-full bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none" />
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Member assignment */}
                  {members.length > 0 && (
                    <div>
                      <p className="text-xs text-surface-400 mb-2">
                        {type === 'chore' ? 'Assign to (leave empty for everyone):' : 'Assign to:'}
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        {members.map(m => (
                          <button key={m.id} type="button" onClick={() => toggleMemberAssignment(m.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-colors min-h-[48px] active:scale-[0.97] ${
                              editForm.assigned_member_ids?.includes(m.id)
                                ? 'bg-forest-600 text-white'
                                : 'bg-surface-700 text-surface-300 hover:bg-surface-600'
                            }`}>
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                            {m.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 justify-end">
                    <button onClick={cancelEdit}
                      className="px-4 py-2.5 bg-surface-700 text-surface-300 rounded-xl text-sm min-h-[48px] active:scale-[0.97]">
                      Cancel
                    </button>
                    <button onClick={addFromEdit} disabled={adding}
                      className="px-4 py-2.5 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium disabled:opacity-50 min-h-[48px] active:scale-[0.97]">
                      Save & Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {sorted.length === 0 && (
            <div className="text-center py-8 text-surface-400">No presets match your search.</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-surface-700">
          <p className="text-sm text-surface-400">
            {addedIds.size > 0 && <span className="text-forest-400">{addedIds.size} added</span>}
            {addedIds.size > 0 && selectedIds.size > 0 && <span className="mx-2">·</span>}
            {selectedIds.size > 0 && <span>{selectedIds.size} selected</span>}
          </p>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="px-4 py-2.5 bg-surface-700 text-surface-300 rounded-xl text-sm min-h-[48px] active:scale-[0.97]">
              Close
            </button>
            {selectedIds.size > 0 && (
              <button onClick={bulkAdd} disabled={adding}
                className="px-4 py-2.5 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium disabled:opacity-50 min-h-[48px] active:scale-[0.97]">
                {adding ? 'Adding...' : `Add Selected (${selectedIds.size})`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
