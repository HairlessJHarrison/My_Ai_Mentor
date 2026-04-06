import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHousehold } from '../context/HouseholdContext';
import { post } from '../hooks/useApi';

function getInitials(name) {
    return name
        .split(' ')
        .map(w => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

function MemberAvatar({ member, isActive, onClick, onAvatarUploaded }) {
    const fileInputRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const pressTimer = useRef(null);

    const handlePointerDown = () => {
        pressTimer.current = setTimeout(() => {
            fileInputRef.current?.click();
        }, 600);
    };

    const handlePointerUp = () => {
        clearTimeout(pressTimer.current);
    };

    const handlePointerLeave = () => {
        clearTimeout(pressTimer.current);
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const apiKey = import.meta.env.VITE_API_KEY || '';
            const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
            const res = await fetch(`${baseUrl}/api/v1/members/${member.id}/avatar`, {
                method: 'POST',
                headers: apiKey ? { 'X-API-Key': apiKey } : {},
                body: formData,
            });
            if (!res.ok) throw new Error('Upload failed');
            const data = await res.json();
            onAvatarUploaded(member.id, data.avatar_url);
        } catch (err) {
            console.error('Avatar upload failed:', err);
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    return (
        <div className="flex flex-col items-center gap-1 select-none">
            <motion.button
                onClick={onClick}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerLeave}
                animate={{
                    scale: isActive ? 1.18 : 1,
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="relative focus:outline-none"
                title={isActive ? member.name : `Switch to ${member.name}`}
            >
                {/* Glow ring for active member */}
                <AnimatePresence>
                    {isActive && (
                        <motion.span
                            key="glow"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="absolute inset-0 rounded-full pointer-events-none"
                            style={{
                                boxShadow: `0 0 0 3px ${member.color}, 0 0 12px 4px ${member.color}55`,
                                borderRadius: '50%',
                            }}
                        />
                    )}
                </AnimatePresence>

                {/* Avatar circle */}
                <div
                    className="relative w-12 h-12 rounded-full overflow-hidden flex items-center justify-center text-white font-bold text-base"
                    style={{ backgroundColor: member.color }}
                >
                    {member.avatar && member.avatar.startsWith('/') ? (
                        <img
                            src={member.avatar}
                            alt={member.name}
                            className="w-full h-full object-cover"
                            onError={e => { e.currentTarget.style.display = 'none'; }}
                        />
                    ) : member.avatar && !member.avatar.startsWith('/') && !/^https?:\/\//.test(member.avatar) ? (
                        // Emoji avatar
                        <span className="text-2xl">{member.avatar}</span>
                    ) : member.avatar && /^https?:\/\//.test(member.avatar) ? (
                        <img
                            src={member.avatar}
                            alt={member.name}
                            className="w-full h-full object-cover"
                            onError={e => { e.currentTarget.style.display = 'none'; }}
                        />
                    ) : (
                        <span>{getInitials(member.name)}</span>
                    )}

                    {uploading && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-full">
                            <span className="text-xs text-white">...</span>
                        </div>
                    )}
                </div>
            </motion.button>

            {/* Name label — only show for active member */}
            <motion.span
                animate={{ opacity: isActive ? 1 : 0.5, fontWeight: isActive ? 600 : 400 }}
                transition={{ duration: 0.2 }}
                className="text-[10px] text-surface-300 max-w-[52px] truncate text-center"
            >
                {member.name.split(' ')[0]}
            </motion.span>

            {/* Hidden file input for avatar upload (long press) */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
            />
        </div>
    );
}

export default function MemberBar() {
    const { members, selectedMemberId, setSelectedMemberId, refresh } = useHousehold();

    if (members.length === 0) return null;

    const handleAvatarUploaded = (_memberId, _url) => {
        // Re-fetch members so the new avatar URL is reflected everywhere
        refresh();
    };

    return (
        <div className="sticky top-0 z-40 bg-surface-900/90 backdrop-blur-md border-b border-surface-700/50">
            <div className="flex items-center gap-4 px-4 py-2 overflow-x-auto no-scrollbar">
                {members.map(member => (
                    <MemberAvatar
                        key={member.id}
                        member={member}
                        isActive={selectedMemberId === member.id}
                        onClick={() => setSelectedMemberId(member.id)}
                        onAvatarUploaded={handleAvatarUploaded}
                    />
                ))}
            </div>
        </div>
    );
}
