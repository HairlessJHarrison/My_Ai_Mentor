import MemberBar from './MemberBar';

export default function Layout({ children }) {
    return (
        <div className="min-h-screen flex flex-col">
            <MemberBar />
            <div className="flex-1">
                {children}
            </div>
        </div>
    );
}
