import { ChevronLeft, ChevronRight } from 'lucide-react';

interface HeaderProps {
  onPrevious: () => void;
  onNext: () => void;
}

export function Header({ onPrevious, onNext }: HeaderProps) {
  return (
    <div className="flex items-center justify-between p-4 bg-white border-b">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold">Collingham and District Local History Society</h1>
      </div>
      <div className="flex gap-2">
        <button onClick={onPrevious} className="p-2 hover:bg-gray-100 rounded-full">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button onClick={onNext} className="p-2 hover:bg-gray-100 rounded-full">
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
