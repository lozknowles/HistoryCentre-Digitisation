import { Calendar } from 'lucide-react';

interface DatePickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function DatePicker({ label, value, onChange }: DatePickerProps) {
  const formatDate = (date: string) => {
    if (!date) return '';
    const [year, month, day] = date.split('-');
    return `${day}/${month}/${year}`;
  };

  const parseDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [day, month, year] = dateStr.split('/');
    return `${year}-${month}-${day}`;
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="mt-1 relative rounded-md shadow-sm">
        <input
          type="date"
          value={parseDate(value)}
          onChange={(e) => onChange(formatDate(e.target.value))}
          className="block w-full pr-10 rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
        />
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <Calendar className="h-5 w-5 text-gray-400" />
        </div>
      </div>
    </div>
  );
}
