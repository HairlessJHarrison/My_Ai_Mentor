import { useState, useCallback } from 'react';
import { post, put, get } from '../hooks/useApi';

const STEPS = ['Welcome', 'Members', 'Calendars', 'Ready'];

const COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
];

const AVATARS = [
  '👤', '👩', '👨', '👧', '👦', '🧑', '👶', '🧓',
  '🦸', '🧑‍💻', '🧑‍🎨', '🧑‍🔬', '🧑‍🍳', '🧑‍🌾',
];

export default function OnboardingWizard({ onComplete }) {
  const [step, setStep] = useState(0);
  const [householdName, setHouseholdName] = useState('');
  const [members, setMembers] = useState([]);
  const [calendarStatus, setCalendarStatus] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // -- Step 1: Member form state --
  const [memberForm, setMemberForm] = useState({
    name: '', role: 'parent', age: '', color: COLORS[0], avatar: '👤',
  });
  const [editingIdx, setEditingIdx] = useState(null);

  const nextStep = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prevStep = () => setStep((s) => Math.max(s - 1, 0));

  // -- Save household name --
  const saveHousehold = useCallback(async () => {
    if (!householdName.trim()) { setError('Please enter a household name'); return; }
    setSaving(true);
    setError('');
    try {
      await put('/config/household', {
        household_id: 'default',
        household_name: householdName.trim(),
      });
      nextStep();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }, [householdName]);

  // -- Add or update a member --
  const saveMember = useCallback(async () => {
    if (!memberForm.name.trim()) { setError('Please enter a name'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        household_id: 'default',
        name: memberForm.name.trim(),
        role: memberForm.role,
        age: memberForm.age ? parseInt(memberForm.age) : null,
        color: memberForm.color,
        avatar: memberForm.avatar,
      };

      if (editingIdx !== null) {
        const existing = members[editingIdx];
        const updated = await put(`/members/${existing.id}`, payload);
        setMembers((prev) => prev.map((m, i) => (i === editingIdx ? updated : m)));
        setEditingIdx(null);
      } else {
        const created = await post('/members', payload);
        setMembers((prev) => [...prev, created]);
      }
      setMemberForm({ name: '', role: 'parent', age: '', color: COLORS[(members.length + 1) % COLORS.length], avatar: '👤' });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }, [memberForm, members, editingIdx]);

  const editMember = (idx) => {
    const m = members[idx];
    setMemberForm({ name: m.name, role: m.role, age: m.age || '', color: m.color, avatar: m.avatar || '👤' });
    setEditingIdx(idx);
  };

  const cancelEdit = () => {
    setEditingIdx(null);
    setMemberForm({ name: '', role: 'parent', age: '', color: COLORS[members.length % COLORS.length], avatar: '👤' });
  };

  // -- Google Calendar --
  const connectCalendar = useCallback(async (member) => {
    setCalendarStatus((prev) => ({ ...prev, [member.id]: 'connecting' }));
    try {
      const { auth_url } = await get(`/google-calendar/auth-url?member_id=${member.id}`);
      // Open OAuth in a popup
      const popup = window.open(auth_url, 'google-auth', 'width=500,height=600,left=200,top=100');

      // Poll for popup close (OAuth redirect will close it or user closes manually)
      const poll = setInterval(async () => {
        if (popup && popup.closed) {
          clearInterval(poll);
          // Check if credentials were saved by trying a sync
          try {
            await post(`/google-calendar/sync/${member.id}`);
            setCalendarStatus((prev) => ({ ...prev, [member.id]: 'connected' }));
          } catch {
            setCalendarStatus((prev) => ({ ...prev, [member.id]: 'failed' }));
          }
        }
      }, 1000);
    } catch (e) {
      setCalendarStatus((prev) => ({ ...prev, [member.id]: 'failed' }));
      setError(e.message);
    }
  }, []);

  // -- Finish onboarding --
  const finish = useCallback(async () => {
    setSaving(true);
    try {
      onComplete();
    } finally {
      setSaving(false);
    }
  }, [onComplete]);

  // -- Progress bar --
  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {STEPS.map((label, i) => (
              <span key={label} className={`text-xs font-medium transition-colors ${i <= step ? 'text-forest-400' : 'text-surface-600'}`}>
                {label}
              </span>
            ))}
          </div>
          <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-forest-500 to-forest-400 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Card */}
        <div className="bg-surface-800 rounded-2xl border border-surface-700/50 shadow-2xl p-8 card-animated">
          {/* ═══ Step 0: Welcome ═══ */}
          {step === 0 && (
            <div>
              <div className="text-center mb-8">
                <span className="text-5xl block mb-4">🌿</span>
                <h1 className="text-2xl font-bold text-surface-100 mb-2">Welcome to Unplugged</h1>
                <p className="text-surface-400 text-sm">Let's set up your household in a few quick steps.</p>
              </div>

              <label className="block text-sm font-medium text-surface-300 mb-2">
                What should we call your household?
              </label>
              <input
                type="text"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveHousehold()}
                placeholder="e.g. The Johnsons"
                className="w-full px-4 py-3 bg-surface-700 border border-surface-600 rounded-xl text-surface-100
                  placeholder:text-surface-500 focus:outline-none focus:border-forest-500 focus:ring-1 focus:ring-forest-500/30
                  transition-colors"
                autoFocus
              />

              {error && <p className="text-rose-400 text-sm mt-2">{error}</p>}

              <button
                onClick={saveHousehold}
                disabled={saving}
                className="w-full mt-6 py-3 bg-forest-600 hover:bg-forest-500 text-white rounded-xl font-semibold
                  transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Continue'}
              </button>
            </div>
          )}

          {/* ═══ Step 1: Members ═══ */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold text-surface-100 mb-1">Add Your Family</h2>
              <p className="text-surface-400 text-sm mb-6">Add each family member. You need at least one.</p>

              {/* Existing members list */}
              {members.length > 0 && (
                <div className="space-y-2 mb-6">
                  {members.map((m, i) => (
                    <div key={m.id}
                      className="flex items-center justify-between p-3 bg-surface-700/50 rounded-xl border border-surface-600/50">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{m.avatar || '👤'}</span>
                        <div>
                          <span className="text-surface-100 font-medium">{m.name}</span>
                          <span className="text-surface-500 text-xs ml-2 capitalize">{m.role}</span>
                          {m.age && <span className="text-surface-500 text-xs ml-1">· {m.age}y</span>}
                        </div>
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: m.color }} />
                      </div>
                      <button onClick={() => editMember(i)} className="text-surface-400 hover:text-surface-200 text-sm px-3 py-2 min-h-[48px] flex items-center rounded-xl active:scale-[0.97]">
                        Edit
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add/edit member form */}
              <div className="space-y-4 p-4 bg-surface-700/30 rounded-xl border border-surface-600/30">
                <p className="text-sm font-medium text-surface-300">
                  {editingIdx !== null ? 'Edit member' : 'New member'}
                </p>

                <input
                  type="text"
                  value={memberForm.name}
                  onChange={(e) => setMemberForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Name"
                  className="w-full px-4 py-2.5 bg-surface-700 border border-surface-600 rounded-xl text-surface-100
                    placeholder:text-surface-500 focus:outline-none focus:border-forest-500 transition-colors text-sm"
                  autoFocus
                />

                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-surface-400 mb-1">Role</label>
                    <select
                      value={memberForm.role}
                      onChange={(e) => setMemberForm((f) => ({ ...f, role: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-surface-700 border border-surface-600 rounded-xl text-surface-100
                        focus:outline-none focus:border-forest-500 transition-colors text-sm"
                    >
                      <option value="parent">Parent</option>
                      <option value="child">Child</option>
                    </select>
                  </div>
                  <div className="w-24">
                    <label className="block text-xs text-surface-400 mb-1">Age</label>
                    <input
                      type="number"
                      value={memberForm.age}
                      onChange={(e) => setMemberForm((f) => ({ ...f, age: e.target.value }))}
                      placeholder="—"
                      className="w-full px-3 py-2.5 bg-surface-700 border border-surface-600 rounded-xl text-surface-100
                        placeholder:text-surface-500 focus:outline-none focus:border-forest-500 transition-colors text-sm"
                    />
                  </div>
                </div>

                {/* Avatar picker */}
                <div>
                  <label className="block text-xs text-surface-400 mb-1.5">Avatar</label>
                  <div className="flex flex-wrap gap-2">
                    {AVATARS.map((av) => (
                      <button
                        key={av}
                        onClick={() => setMemberForm((f) => ({ ...f, avatar: av }))}
                        className={`w-11 h-11 rounded-xl text-xl flex items-center justify-center transition-all active:scale-[0.95]
                          ${memberForm.avatar === av
                            ? 'bg-forest-600/40 ring-2 ring-forest-400 scale-110'
                            : 'bg-surface-700 hover:bg-surface-600'}`}
                      >
                        {av}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color picker */}
                <div>
                  <label className="block text-xs text-surface-400 mb-1.5">Color</label>
                  <div className="flex gap-2.5">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setMemberForm((f) => ({ ...f, color: c }))}
                        className={`w-11 h-11 rounded-full transition-all active:scale-[0.95] ${memberForm.color === c ? 'ring-2 ring-offset-2 ring-offset-surface-800 ring-forest-400 scale-110' : 'hover:scale-110'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                {error && <p className="text-rose-400 text-sm">{error}</p>}

                <div className="flex gap-2">
                  {editingIdx !== null && (
                    <button onClick={cancelEdit}
                      className="flex-1 py-2.5 bg-surface-600 hover:bg-surface-500 text-surface-300 rounded-xl text-sm font-medium transition-colors min-h-[48px] active:scale-[0.97]">
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={saveMember}
                    disabled={saving}
                    className="flex-1 py-2.5 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-semibold
                      transition-colors disabled:opacity-50 min-h-[48px] active:scale-[0.97]"
                  >
                    {saving ? 'Saving...' : editingIdx !== null ? 'Update' : 'Add Member'}
                  </button>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex gap-3 mt-6">
                <button onClick={prevStep}
                  className="flex-1 py-3 bg-surface-700 hover:bg-surface-600 text-surface-300 rounded-xl text-sm font-medium transition-colors">
                  Back
                </button>
                <button
                  onClick={nextStep}
                  disabled={members.length === 0}
                  className="flex-1 py-3 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-semibold
                    transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue ({members.length} added)
                </button>
              </div>
            </div>
          )}

          {/* ═══ Step 2: Google Calendar ═══ */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold text-surface-100 mb-1">Connect Calendars</h2>
              <p className="text-surface-400 text-sm mb-6">
                Optionally link Google Calendar for each member to sync events automatically.
              </p>

              <div className="space-y-3 mb-6">
                {members.map((m) => {
                  const status = calendarStatus[m.id];
                  const isConnected = status === 'connected' || m.google_credentials;
                  const isConnecting = status === 'connecting';
                  const isFailed = status === 'failed';

                  return (
                    <div key={m.id}
                      className="flex items-center justify-between p-4 bg-surface-700/50 rounded-xl border border-surface-600/50">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{m.avatar || '👤'}</span>
                        <span className="text-surface-100 font-medium">{m.name}</span>
                      </div>

                      {isConnected ? (
                        <span className="flex items-center gap-1.5 text-forest-400 text-sm font-medium">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Connected
                        </span>
                      ) : isConnecting ? (
                        <span className="text-amber-400 text-sm flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                          Connecting...
                        </span>
                      ) : (
                        <button
                          onClick={() => connectCalendar(m)}
                          className="px-4 py-2.5 bg-surface-600 hover:bg-surface-500 text-surface-200 rounded-xl text-sm
                            font-medium transition-colors flex items-center gap-2 min-h-[48px] active:scale-[0.97]"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19.5 3h-15A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3zM12 17.25a.75.75 0 01-.75-.75v-3.75H7.5a.75.75 0 010-1.5h3.75V7.5a.75.75 0 011.5 0v3.75h3.75a.75.75 0 010 1.5h-3.75v3.75a.75.75 0 01-.75.75z" />
                          </svg>
                          {isFailed ? 'Retry' : 'Connect'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {error && <p className="text-rose-400 text-sm mb-4">{error}</p>}

              <div className="flex gap-3">
                <button onClick={prevStep}
                  className="flex-1 py-3 bg-surface-700 hover:bg-surface-600 text-surface-300 rounded-xl text-sm font-medium transition-colors">
                  Back
                </button>
                <button onClick={nextStep}
                  className="flex-1 py-3 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-semibold transition-colors">
                  {Object.values(calendarStatus).some((s) => s === 'connected') ? 'Continue' : 'Skip for Now'}
                </button>
              </div>
            </div>
          )}

          {/* ═══ Step 3: Ready ═══ */}
          {step === 3 && (
            <div className="text-center">
              <span className="text-5xl block mb-4">🎉</span>
              <h2 className="text-2xl font-bold text-surface-100 mb-2">You're All Set!</h2>
              <p className="text-surface-400 text-sm mb-8">
                Your household "<span className="text-surface-200">{householdName}</span>" is ready
                with {members.length} member{members.length !== 1 ? 's' : ''}.
              </p>

              {/* Summary */}
              <div className="flex justify-center gap-3 flex-wrap mb-8">
                {members.map((m) => (
                  <div key={m.id} className="flex flex-col items-center gap-1 p-3 bg-surface-700/50 rounded-xl min-w-[80px]">
                    <span className="text-3xl">{m.avatar || '👤'}</span>
                    <span className="text-surface-200 text-sm font-medium">{m.name}</span>
                    <span className="text-xs capitalize text-surface-500">{m.role}</span>
                    {(calendarStatus[m.id] === 'connected' || m.google_credentials) && (
                      <span className="text-forest-400 text-xs">📅 Synced</span>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={finish}
                disabled={saving}
                className="w-full py-4 bg-gradient-to-r from-forest-600 to-forest-500 hover:from-forest-500 hover:to-forest-400
                  text-white rounded-xl text-lg font-semibold transition-all shadow-lg shadow-forest-900/50
                  hover:shadow-xl hover:shadow-forest-800/50 disabled:opacity-50"
              >
                {saving ? 'Loading...' : 'Go to Dashboard →'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
