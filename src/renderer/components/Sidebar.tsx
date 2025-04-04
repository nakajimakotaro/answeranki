import { Link, useLocation } from 'react-router-dom';
import { Settings, FileText, List, BookOpen, Calendar, GraduationCap, BarChart, FileCheck } from 'lucide-react';

const Sidebar = () => {
  const location = useLocation();
  
  const isActive = (path: string) => {
    return location.pathname === path ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-200';
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-xl font-bold text-primary">Answer2Anki</h1>
        <p className="text-sm text-gray-500">大学受験スケジュール管理</p>
      </div>
      
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          <li>
            <Link 
              to="/" 
              className={`flex items-center p-2 rounded-md ${isActive('/')}`}
            >
              <BarChart className="w-5 h-5 mr-3" />
              <span>ダッシュボード</span>
            </Link>
          </li>
          <li>
            <Link 
              to="/schedules" 
              className={`flex items-center p-2 rounded-md ${isActive('/schedules')}`}
            >
              <Calendar className="w-5 h-5 mr-3" />
              <span>スケジュール</span>
            </Link>
          </li>
          <li>
            <Link 
              to="/universities" 
              className={`flex items-center p-2 rounded-md ${isActive('/universities')}`}
            >
              <GraduationCap className="w-5 h-5 mr-3" />
              <span>志望校</span>
            </Link>
          </li>
          <li>
            <Link 
              to="/textbooks" 
              className={`flex items-center p-2 rounded-md ${isActive('/textbooks')}`}
            >
              <BookOpen className="w-5 h-5 mr-3" />
              <span>参考書</span>
            </Link>
          </li>
          <li>
            <Link 
              to="/problems" 
              className={`flex items-center p-2 rounded-md ${isActive('/problems')}`}
            >
              <List className="w-5 h-5 mr-3" />
              <span>問題一覧</span>
            </Link>
          </li>
          <li>
            <Link 
              to="/mock-exams" 
              className={`flex items-center p-2 rounded-md ${isActive('/mock-exams')}`}
            >
              <FileCheck className="w-5 h-5 mr-3" />
              <span>模試管理</span>
            </Link>
          </li>
          <li>
            <Link 
              to="/settings" 
              className={`flex items-center p-2 rounded-md ${isActive('/settings')}`}
            >
              <Settings className="w-5 h-5 mr-3" />
              <span>設定</span>
            </Link>
          </li>
        </ul>
      </nav>
      
      <div className="p-4 border-t border-gray-200 text-xs text-gray-500">
        <p>Version 1.0.0</p>
      </div>
    </div>
  );
};

export default Sidebar;
