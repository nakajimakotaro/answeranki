import React from 'react';
import { useError } from '../context/ErrorContext';

const GlobalErrorDisplay: React.FC = () => {
  const { errorMessage, setError } = useError();

  if (!errorMessage) {
    return null; // エラーメッセージがなければ何も表示しない
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(255, 0, 0, 0.85)', // より目立つ赤色、少し透明度を下げる
        color: 'white',
        padding: '15px 25px', // パディングを増やす
        borderRadius: '8px', // 角を丸くする
        zIndex: 10000, // 他の要素より手前に表示
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)', // 影を強くする
        maxWidth: '80%', // 最大幅を設定
        textAlign: 'center',
        fontSize: '1.1em', // フォントサイズを少し大きく
        border: '1px solid darkred', // 濃い赤色の境界線
      }}
    >
      <p style={{ margin: 0, marginRight: '30px' }}>エラー: {errorMessage}</p>
      <button
        onClick={() => setError(null)} // エラーメッセージを閉じる
        style={{
          position: 'absolute',
          top: '5px',
          right: '10px',
          background: 'none',
          border: 'none',
          color: 'white',
          fontSize: '1.5em', // ボタンのサイズを大きく
          cursor: 'pointer',
          padding: '5px',
          lineHeight: '1',
        }}
        aria-label="閉じる"
      >
        &times; {/* Unicodeの乗算記号 */}
      </button>
    </div>
  );
};

export default GlobalErrorDisplay;
