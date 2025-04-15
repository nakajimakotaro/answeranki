import { Scan } from 'lucide-react';
import { ScannerSectionProps } from './types';

const ScannerSection = ({
  scannerInitialized,
  isScanning,
  onScan,
}: ScannerSectionProps) => {
  return (
    <div className="mb-4">
      <button
        onClick={onScan}
        disabled={!scannerInitialized || isScanning}
        className={`w-full flex items-center justify-center p-2 rounded ${
          !scannerInitialized || isScanning
            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
        }`}
      >
        <Scan className="w-4 h-4 mr-2" />
        {isScanning ? 'スキャン中...' : 'スキャナーで読み取り'}
      </button>
      {!scannerInitialized && <p className="text-xs text-red-500 mt-1 text-center">スキャナーが初期化されていません。</p>}
    </div>
  );
};

export default ScannerSection;
