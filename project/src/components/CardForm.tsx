import React from 'react';
import type { ArchiveCard } from '../types/Card';

interface CardFormProps {
  data: ArchiveCard;
  onChange: (field: keyof ArchiveCard, value: any) => void;
}

export function CardForm({ data, onChange }: CardFormProps) {
  const handleChange = (field: keyof ArchiveCard) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    onChange(field, e.target.value);
  };

  const formatDate = (date: string) => {
    if (!date) return '';
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  };

  return (
    <div className="max-w-5xl mx-auto bg-white p-8 rounded-lg shadow-lg">
      <div className="text-center mb-6 border-b pb-4">
        <h1 className="text-2xl font-serif italic">Collingham and District Local History Society</h1>
      </div>

      <div className="space-y-6">
        {/* First Row */}
        <div className="grid grid-cols-4 gap-4">
          <div className="col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Simple object name</label>
            <input
              type="text"
              value={data.objectName}
              onChange={handleChange('objectName')}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:ring-0 focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ID number</label>
            <input
              type="text"
              value={data.idNumber}
              onChange={handleChange('idNumber')}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:ring-0 focus:border-gray-500"
            />
          </div>
        </div>

        {/* Second Row */}
        <div className="grid grid-cols-4 gap-4">
          <div className="col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={data.title}
              onChange={handleChange('title')}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:ring-0 focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date received</label>
            <input
              type="date"
              value={formatDate(data.dateReceived)}
              onChange={handleChange('dateReceived')}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:ring-0 focus:border-gray-500"
            />
          </div>
        </div>

        {/* Brief Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Brief description</label>
          <textarea
            rows={3}
            value={data.briefDescription}
            onChange={handleChange('briefDescription')}
            className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:ring-0 focus:border-gray-500"
          />
        </div>

        {/* Donated/loan section */}
        <div className="grid grid-cols-4 gap-4">
          <div className="col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Donated/loan by</label>
            <input
              type="text"
              value={data.donatedBy}
              onChange={handleChange('donatedBy')}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:ring-0 focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={formatDate(data.donationDate)}
              onChange={handleChange('donationDate')}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:ring-0 focus:border-gray-500"
            />
          </div>
        </div>

        {/* Copyright */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Copyright</label>
          <input
            type="text"
            value={data.copyright}
            onChange={handleChange('copyright')}
            className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:ring-0 focus:border-gray-500"
          />
        </div>

        {/* Associated Information */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Associated people</label>
            <input
              type="text"
              value={data.associatedPeople.join(', ')}
              onChange={(e) => onChange('associatedPeople', e.target.value.split(',').map(s => s.trim()))}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:ring-0 focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Associated places</label>
            <input
              type="text"
              value={data.associatedPlaces.join(', ')}
              onChange={(e) => onChange('associatedPlaces', e.target.value.split(',').map(s => s.trim()))}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:ring-0 focus:border-gray-500"
            />
          </div>
        </div>

        {/* Location Grid */}
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Home location</label>
            <input
              type="text"
              value={data.homeLocation}
              onChange={handleChange('homeLocation')}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:ring-0 focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={formatDate(data.homeLocationDate)}
              onChange={handleChange('homeLocationDate')}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:ring-0 focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current location</label>
            <input
              type="text"
              value={data.currentLocation}
              onChange={handleChange('currentLocation')}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:ring-0 focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={formatDate(data.currentLocationDate)}
              onChange={handleChange('currentLocationDate')}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:ring-0 focus:border-gray-500"
            />
          </div>
        </div>

        {/* Physical Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Physical description, family, street, house</label>
          <textarea
            rows={4}
            value={data.physicalDescription}
            onChange={handleChange('physicalDescription')}
            className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:ring-0 focus:border-gray-500"
            placeholder="Enter physical description, family details, street address, and house information..."
          />
        </div>

        {/* Size and Condition */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
            <input
              type="text"
              value={data.size}
              onChange={handleChange('size')}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:ring-0 focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
            <input
              type="text"
              value={data.condition}
              onChange={handleChange('condition')}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:ring-0 focus:border-gray-500"
            />
          </div>
        </div>

        {/* Notes and Cross References */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes, cross references etc.</label>
          <textarea
            rows={4}
            value={data.crossReferences}
            onChange={handleChange('crossReferences')}
            className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:ring-0 focus:border-gray-500"
            placeholder="Enter any additional notes, cross references, or other relevant information..."
          />
        </div>
      </div>
    </div>
  );
}
