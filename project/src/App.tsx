import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Navigation } from './components/Navigation';
import { CardMaintenance } from './pages/CardMaintenance';
import { Search } from './pages/Search';
import { CheckoutManagement } from './pages/CheckoutManagement';
import { OcrReview } from './pages/OcrReview';

export default function App() {
  return (
    <HashRouter>
      <div className="min-h-screen bg-gray-100">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Routes>
            <Route path="/review" element={<OcrReview />} />
            <Route path="/cards" element={<CardMaintenance />} />
            <Route path="/search" element={<Search />} />
            <Route path="/checkouts" element={<CheckoutManagement />} />
            <Route path="/" element={<Navigate to="/cards" replace />} />
          </Routes>
        </div>
      </div>
    </HashRouter>
  );
}
