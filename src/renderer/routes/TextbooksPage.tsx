import { useState, useEffect } from 'react';
import { scheduleService, Textbook } from '../services/scheduleService';
import { ankiConnectService } from '../services/ankiConnectService';
import { BookOpen, Plus, Edit, Trash, Link as LinkIcon } from 'lucide-react';

const TextbooksPage = () => {
  // 状態管理
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [editingTextbook, setEditingTextbook] = useState<Textbook | null>(null);
  const [linkingTextbook, setLinkingTextbook] = useState<Textbook | null>(null);
  const [deckNames, setDeckNames] = useState<string[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<string>('');
  
  // フォーム状態
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [totalProblems, setTotalProblems] = useState(0);
  
  // データ取得
  useEffect(() => {
    fetchTextbooks();
  }, []);
  
  // 参考書一覧を取得
  const fetchTextbooks = async () => {
    try {
      setLoading(true);
      const data = await scheduleService.getTextbooks();
      setTextbooks(data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching textbooks:', err);
      setError('参考書の取得中にエラーが発生しました');
      setLoading(false);
    }
  };
  
  // モーダルを開く（新規作成）
  const openCreateModal = () => {
    setEditingTextbook(null);
    setTitle('');
    setSubject('');
    setTotalProblems(0);
    setIsModalOpen(true);
  };
  
  // モーダルを開く（編集）
  const openEditModal = (textbook: Textbook) => {
    setEditingTextbook(textbook);
    setTitle(textbook.title);
    setSubject(textbook.subject);
    setTotalProblems(textbook.total_problems);
    setIsModalOpen(true);
  };
  
  // Ankiデッキ紐付けモーダルを開く
  const openLinkModal = async (textbook: Textbook) => {
    try {
      setLinkingTextbook(textbook);
      
      // Ankiデッキ一覧を取得
      const decks = await ankiConnectService.getDeckNames();
      setDeckNames(decks);
      setSelectedDeck(textbook.anki_deck_name || '');
      
      setIsLinkModalOpen(true);
    } catch (err) {
      console.error('Error fetching Anki decks:', err);
      setError('Ankiデッキの取得中にエラーが発生しました');
    }
  };
  
  // 参考書を保存
  const handleSaveTextbook = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || !subject) {
      setError('タイトルと科目は必須です');
      return;
    }
    
    try {
      const textbookData: Textbook = {
        title,
        subject,
        total_problems: totalProblems
      };
      
      if (editingTextbook && editingTextbook.id) {
        // 既存の参考書を更新
        await scheduleService.updateTextbook(editingTextbook.id, textbookData);
      } else {
        // 新しい参考書を作成
        await scheduleService.createTextbook(textbookData);
      }
      
      // 参考書一覧を再取得
      await fetchTextbooks();
      
      // モーダルを閉じる
      setIsModalOpen(false);
      setEditingTextbook(null);
      
    } catch (err) {
      console.error('Error saving textbook:', err);
      setError('参考書の保存中にエラーが発生しました');
    }
  };
  
  // 参考書を削除
  const handleDeleteTextbook = async (id: number) => {
    if (!confirm('この参考書を削除してもよろしいですか？関連するスケジュールや学習ログも削除されます。')) {
      return;
    }
    
    try {
      await scheduleService.deleteTextbook(id);
      
      // 参考書一覧を再取得
      await fetchTextbooks();
      
    } catch (err) {
      console.error('Error deleting textbook:', err);
      setError('参考書の削除中にエラーが発生しました');
    }
  };
  
  // Ankiデッキと紐付け
  const handleLinkToDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!linkingTextbook || !linkingTextbook.id) {
      return;
    }
    
    try {
      await scheduleService.linkTextbookToAnkiDeck(linkingTextbook.id, selectedDeck);
      
      // 参考書一覧を再取得
      await fetchTextbooks();
      
      // モーダルを閉じる
      setIsLinkModalOpen(false);
      setLinkingTextbook(null);
      
    } catch (err) {
      console.error('Error linking textbook to Anki deck:', err);
      setError('Ankiデッキとの紐付け中にエラーが発生しました');
    }
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">参考書管理</h1>
        <button
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark flex items-center"
          onClick={openCreateModal}
        >
          <Plus className="w-4 h-4 mr-2" />
          新規作成
        </button>
      </div>
      
      {error && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      
      {/* 参考書一覧 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">タイトル</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">科目</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">問題数</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ankiデッキ</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {textbooks.length > 0 ? (
              textbooks.map((textbook) => (
                <tr key={textbook.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <BookOpen className="h-5 w-5 text-gray-400 mr-2" />
                      <div className="text-sm font-medium text-gray-900">{textbook.title}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{textbook.subject}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{textbook.total_problems}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {textbook.anki_deck_name || '未設定'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        className="text-indigo-600 hover:text-indigo-900"
                        onClick={() => openEditModal(textbook)}
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                      <button
                        className="text-blue-600 hover:text-blue-900"
                        onClick={() => openLinkModal(textbook)}
                      >
                        <LinkIcon className="h-5 w-5" />
                      </button>
                      <button
                        className="text-red-600 hover:text-red-900"
                        onClick={() => textbook.id && handleDeleteTextbook(textbook.id)}
                      >
                        <Trash className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                  参考書が登録されていません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* 参考書編集モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingTextbook ? '参考書を編集' : '新しい参考書を追加'}
            </h2>
            
            <form onSubmit={handleSaveTextbook}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  タイトル
                </label>
                <input
                  type="text"
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  科目
                </label>
                <input
                  type="text"
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  総問題数
                </label>
                <input
                  type="number"
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={totalProblems}
                  onChange={(e) => setTotalProblems(Number(e.target.value))}
                  min={0}
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                  onClick={() => setIsModalOpen(false)}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Ankiデッキ紐付けモーダル */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              Ankiデッキと紐付ける
            </h2>
            
            <p className="mb-4 text-sm text-gray-600">
              参考書「{linkingTextbook?.title}」をAnkiデッキと紐付けます。
            </p>
            
            <form onSubmit={handleLinkToDeck}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ankiデッキ
                </label>
                <select
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={selectedDeck}
                  onChange={(e) => setSelectedDeck(e.target.value)}
                >
                  <option value="">デッキを選択してください</option>
                  {deckNames.map((deck) => (
                    <option key={deck} value={deck}>
                      {deck}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                  onClick={() => setIsLinkModalOpen(false)}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
                  disabled={!selectedDeck}
                >
                  紐付ける
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TextbooksPage;
