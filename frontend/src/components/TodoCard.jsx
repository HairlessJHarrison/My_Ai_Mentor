import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { get } from '../hooks/useApi';

export default function TodoCard() {
    const navigate = useNavigate();
    const [todos, setTodos] = useState([]);

    useEffect(() => {
        get('/todos?completed=false').then(setTodos).catch(console.error);
    }, []);

    const count = todos.length;
    const priorityEmoji = { high: '🔴', medium: '🟡', low: '🟢' };

    return (
        <div
            className="card-animated bg-surface-800 rounded-2xl p-5 cursor-pointer hover:bg-surface-700 transition-colors"
            onClick={() => navigate('/todos')}
            style={{ animationDelay: '0.6s' }}
        >
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-surface-100 flex items-center gap-2">
                    <span className="text-xl">✅</span> To-Do
                </h3>
                <span className="text-xs text-surface-400">
                    {count === 0 ? 'All done!' : `${count} open`}
                </span>
            </div>

            <div className="flex items-center gap-4 mb-4">
                <div className="relative w-20 h-20 shrink-0">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                        <circle cx="40" cy="40" r="34" fill="none" stroke="var(--color-surface-700)" strokeWidth="6" />
                        <circle
                            cx="40" cy="40" r="34" fill="none"
                            stroke="url(#todoGradient)" strokeWidth="6"
                            strokeLinecap="round"
                            strokeDasharray={`${count > 0 ? Math.min(count / Math.max(count, 1), 1) * 213.6 : 213.6} 213.6`}
                            className="transition-all duration-700"
                        />
                        <defs>
                            <linearGradient id="todoGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="var(--color-ocean-400)" />
                                <stop offset="100%" stopColor="var(--color-forest-400)" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-surface-100">
                        {count}
                    </span>
                </div>
                <div className="flex-1">
                    <p className="text-sm text-surface-300">
                        {count === 0 ? 'No open to-dos' : `${count} item${count === 1 ? '' : 's'} remaining`}
                    </p>
                    {count > 0 && (
                        <p className="text-xs text-ocean-400 mt-1">Tap to manage</p>
                    )}
                </div>
            </div>

            {todos.length > 0 && (
                <div className="space-y-1.5">
                    {todos.slice(0, 3).map((todo, i) => (
                        <div key={todo.id || i} className="flex justify-between text-sm px-3 py-2.5 bg-surface-700/40 rounded-lg">
                            <span className="text-surface-300 truncate mr-2">
                                {priorityEmoji[todo.priority] || '🟡'} {todo.title}
                            </span>
                            {todo.due_date && (
                                <span className="text-surface-500 text-xs whitespace-nowrap self-center">
                                    {new Date(todo.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
