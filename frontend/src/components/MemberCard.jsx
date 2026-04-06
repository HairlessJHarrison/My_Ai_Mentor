import { motion } from 'framer-motion';

/**
 * Reusable card with a colored left border for family member color coding.
 * Wrap any list item in this to get the Skylight-style colored-border card pattern.
 *
 * Props:
 *   color     - hex color for the left border (member's assigned color)
 *   children  - card content
 *   onClick   - if provided, card becomes clickable with hover state
 *   className - extra classes on the outer wrapper
 *   style     - extra inline styles (e.g. animationDelay)
 */
export default function MemberCard({ color, children, className = '', onClick, style }) {
    return (
        <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`flex bg-surface-800 rounded-xl overflow-hidden shadow-sm ${
                onClick
                    ? 'cursor-pointer hover:bg-surface-700 active:scale-[0.99] transition-colors'
                    : ''
            } ${className}`}
            onClick={onClick}
            style={style}
        >
            {/* Colored left border */}
            <div
                className="w-[5px] shrink-0"
                style={{ backgroundColor: color || 'transparent' }}
            />
            {/* Content */}
            <div className="flex-1 min-w-0">
                {children}
            </div>
        </motion.div>
    );
}
