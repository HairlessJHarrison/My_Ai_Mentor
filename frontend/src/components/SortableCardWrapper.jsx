import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export default function SortableCardWrapper({ id, children }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.8 : 1,
        position: 'relative',
    };

    return (
        <div ref={setNodeRef} style={style} className={`relative flex flex-col h-full bg-surface-800 rounded-2xl ${isDragging ? 'shadow-2xl ring-2 ring-forest-500' : ''}`}>
             <div 
                {...attributes} 
                {...listeners} 
                className="absolute top-2 right-2 p-1.5 cursor-grab active:cursor-grabbing text-surface-500 hover:text-surface-300 z-50 bg-black/20 rounded-md backdrop-blur-sm"
                title="Drag to reorder"
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="12" r="1" /><circle cx="9" cy="5" r="1" /><circle cx="9" cy="19" r="1" />
                    <circle cx="15" cy="12" r="1" /><circle cx="15" cy="5" r="1" /><circle cx="15" cy="19" r="1" />
                </svg>
            </div>
            {/* We render standard cards transparently inside since they already have card classes, 
                but we need to ensure the wrapper handles the grid cell properly. */}
            <div className="flex-1 w-full h-full [&>div]:h-full [&>div]:shadow-none [&>div]:border-none">
                {children}
            </div>
        </div>
    );
}
