import { Outlet } from 'react-router-dom';
import BottomTabBar from './BottomTabBar';

export default function Layout() {
    return (
        <>
            <div className="pb-20">
                <Outlet />
            </div>
            <BottomTabBar />
        </>
    );
}
