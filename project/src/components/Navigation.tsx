import { NavLink } from 'react-router-dom';
import { Archive, Search, BookOpen, ScanText } from 'lucide-react';
import logo from '../assets/logo.jpg';

export function Navigation() {
  return (
    <nav className="bg-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <img 
                src={logo}
                alt="CDLHS" 
                className="h-8 w-auto"
              />
              <span className="ml-3 text-xl font-semibold text-gray-900">
                Archive System
              </span>
            </div>
            <div className="ml-10 flex space-x-8">
              <NavLink
                to="/cards"
                className={({ isActive }) =>
                  `inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    isActive
                      ? 'border-blue-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`
                }
              >
                <Archive className="h-5 w-5 mr-2" />
                Card Maintenance
              </NavLink>
              <NavLink
                to="/search"
                className={({ isActive }) =>
                  `inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    isActive
                      ? 'border-blue-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`
                }
              >
                <Search className="h-5 w-5 mr-2" />
                Search
              </NavLink>
              <NavLink
                to="/review"
                className={({ isActive }) =>
                  `inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    isActive
                      ? 'border-blue-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`
                }
              >
                <ScanText className="h-5 w-5 mr-2" />
                OCR Review
              </NavLink>
              <NavLink
                to="/checkouts"
                className={({ isActive }) =>
                  `inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    isActive
                      ? 'border-blue-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`
                }
              >
                <BookOpen className="h-5 w-5 mr-2" />
                Checkouts
              </NavLink>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
