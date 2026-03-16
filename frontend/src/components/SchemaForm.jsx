import { useState, useEffect } from 'react';
import { get } from '../hooks/useApi';

/**
 * SchemaForm - A generic form component that renders fields from a JSON Schema.
 *
 * Fetches model schemas from /api/v1/config/schema, finds the requested model,
 * and renders input fields for each property.
 *
 * Props:
 *   modelName   - Name of the Pydantic model (e.g. "ScheduleEventCreate")
 *   onSubmit    - Callback with the form data object
 *   initialData - Optional initial values
 *   submitLabel - Button text (default: "Submit")
 *   onCancel    - Optional cancel callback
 *   exclude     - Array of field names to exclude from the form
 */
export default function SchemaForm({ modelName, onSubmit, initialData = {}, submitLabel = 'Submit', onCancel, exclude = [] }) {
    const [schema, setSchema] = useState(null);
    const [formData, setFormData] = useState(initialData);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        get('/config/schema')
            .then((data) => {
                const models = data.models || {};
                const found = models[modelName];
                if (found) {
                    setSchema(found);
                    // Pre-fill defaults from schema
                    const defaults = {};
                    const props = found.properties || {};
                    Object.entries(props).forEach(([key, prop]) => {
                        if (exclude.includes(key)) return;
                        if (initialData[key] !== undefined) {
                            defaults[key] = initialData[key];
                        } else if (prop.default !== undefined) {
                            defaults[key] = prop.default;
                        } else if (prop.type === 'boolean') {
                            defaults[key] = false;
                        } else if (prop.type === 'integer' || prop.type === 'number') {
                            defaults[key] = '';
                        } else if (prop.type === 'array') {
                            defaults[key] = [];
                        } else {
                            defaults[key] = '';
                        }
                    });
                    setFormData(prev => ({ ...defaults, ...prev }));
                } else {
                    setError(`Schema "${modelName}" not found`);
                }
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [modelName]);

    const handleChange = (key, value, prop) => {
        let parsed = value;
        if (prop.type === 'integer') parsed = value === '' ? '' : parseInt(value, 10);
        if (prop.type === 'number') parsed = value === '' ? '' : parseFloat(value);
        if (prop.type === 'boolean') parsed = value;
        setFormData(prev => ({ ...prev, [key]: parsed }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // Clean empty strings out
        const cleaned = {};
        Object.entries(formData).forEach(([k, v]) => {
            if (v !== '' && v !== undefined) cleaned[k] = v;
        });
        onSubmit(cleaned);
    };

    if (loading) return <div className="text-surface-400 text-sm py-4">Loading form...</div>;
    if (error) return <div className="text-rose-400 text-sm py-4">{error}</div>;
    if (!schema) return null;

    const properties = schema.properties || {};
    const required = schema.required || [];
    const fields = Object.entries(properties).filter(([key]) => !exclude.includes(key));

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fields.map(([key, prop]) => {
                    const isRequired = required.includes(key);
                    const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

                    // Enum select
                    if (prop.enum || prop.allOf?.[0]?.enum) {
                        const options = prop.enum || prop.allOf[0].enum;
                        return (
                            <div key={key}>
                                <label className="block text-xs text-surface-400 mb-1">
                                    {label}{isRequired && <span className="text-rose-400"> *</span>}
                                </label>
                                <select
                                    value={formData[key] || ''}
                                    onChange={e => handleChange(key, e.target.value, prop)}
                                    className="w-full bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none"
                                    required={isRequired}
                                >
                                    <option value="">Select...</option>
                                    {options.map(opt => (
                                        <option key={opt} value={opt}>{opt.replace(/_/g, ' ')}</option>
                                    ))}
                                </select>
                            </div>
                        );
                    }

                    // Boolean toggle
                    if (prop.type === 'boolean') {
                        return (
                            <div key={key} className="flex items-center gap-3 py-2">
                                <label className="flex items-center gap-2 text-sm text-surface-300 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={!!formData[key]}
                                        onChange={e => handleChange(key, e.target.checked, prop)}
                                        className="w-4 h-4 rounded accent-forest-600"
                                    />
                                    {label}
                                </label>
                            </div>
                        );
                    }

                    // Number input
                    if (prop.type === 'integer' || prop.type === 'number') {
                        return (
                            <div key={key}>
                                <label className="block text-xs text-surface-400 mb-1">
                                    {label}{isRequired && <span className="text-rose-400"> *</span>}
                                </label>
                                <input
                                    type="number"
                                    value={formData[key] ?? ''}
                                    onChange={e => handleChange(key, e.target.value, prop)}
                                    min={prop.minimum ?? prop.ge}
                                    max={prop.maximum ?? prop.le}
                                    step={prop.type === 'number' ? '0.01' : '1'}
                                    placeholder={prop.description || label}
                                    className="w-full bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none"
                                    required={isRequired}
                                />
                            </div>
                        );
                    }

                    // Default: text input
                    return (
                        <div key={key}>
                            <label className="block text-xs text-surface-400 mb-1">
                                {label}{isRequired && <span className="text-rose-400"> *</span>}
                            </label>
                            <input
                                type={key.includes('date') ? 'date' : key.includes('time') ? 'time' : 'text'}
                                value={formData[key] || ''}
                                onChange={e => handleChange(key, e.target.value, prop)}
                                placeholder={prop.description || label}
                                className="w-full bg-surface-700 text-surface-100 rounded-xl px-4 py-3 text-sm outline-none"
                                required={isRequired}
                            />
                        </div>
                    );
                })}
            </div>

            <div className="flex gap-3 justify-end pt-2">
                {onCancel && (
                    <button type="button" onClick={onCancel}
                        className="px-4 py-2.5 bg-surface-700 text-surface-300 rounded-xl text-sm min-h-[44px] active:scale-[0.97]">
                        Cancel
                    </button>
                )}
                <button type="submit"
                    className="px-4 py-2.5 bg-forest-600 hover:bg-forest-500 text-white rounded-xl text-sm font-medium min-h-[44px] active:scale-[0.97]">
                    {submitLabel}
                </button>
            </div>
        </form>
    );
}
