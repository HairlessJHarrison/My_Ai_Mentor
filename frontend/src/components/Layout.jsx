import { Outlet } from 'react-router-dom';
import BottomTabBar from './BottomTabBar';
import MemberBar from './MemberBar';

export default function Layout() {
    return (
        <div className="min-h-screen flex flex-col">
            <MemberBar />
            <div className="flex-1 pb-20">
                <Outlet />
            </div>
            <BottomTabBar />
        </div>
    );
}
