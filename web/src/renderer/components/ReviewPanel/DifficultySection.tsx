import { DifficultySectionProps } from './types';

const DifficultySection = ({ selectedEase, onEaseSelect }: DifficultySectionProps) => {
  const easeOptions = [
    { label: 'もう一度', value: 1, color: 'red' },
    { label: '難しい', value: 2, color: 'yellow' },
    { label: '普通', value: 3, color: 'blue' },
    { label: '簡単', value: 4, color: 'green' },
  ];

  return (
    <div className="mb-4">
      <div className="grid grid-cols-4 gap-1">
        {easeOptions.map(ease => (
          <button
            key={ease.value}
            type="button"
            onClick={() => onEaseSelect(selectedEase === ease.value ? null : ease.value as 1 | 2 | 3 | 4)}
            className={`p-2 rounded text-xs border transition-colors ${
              selectedEase === ease.value
                ? `bg-${ease.color}-500 text-white border-${ease.color}-500 ring-2 ring-offset-1 ring-${ease.color}-400`
                : `bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400`
            }`}
          >
            {ease.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default DifficultySection;
