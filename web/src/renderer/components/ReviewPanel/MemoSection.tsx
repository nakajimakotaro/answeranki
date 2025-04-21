import { MemoSectionProps } from './types';

const MemoSection = ({ memo, onMemoChange }: MemoSectionProps) => {
  return (
    <div className="mb-4">
      <textarea
        id="memo"
        rows={3}
        placeholder="解答に関するメモを入力..."
        value={memo}
        onChange={(e) => onMemoChange(e.target.value)}
        className="w-full border rounded p-2 text-sm focus:ring-primary focus:border-primary"
      />
    </div>
  );
};

export default MemoSection;
