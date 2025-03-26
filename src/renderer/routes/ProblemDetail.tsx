import { useParams, useNavigate } from 'react-router-dom';
import ProblemView from '../components/ProblemView';

/**
 * 特定の問題の詳細を表示するページ
 */
const ProblemDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const noteId = id ? parseInt(id, 10) : 0;
  
  // 問題一覧に戻る処理
  const handleNavigateBack = () => {
    navigate('/');
  };
  
  return (
    <ProblemView 
      noteId={noteId}
      onNavigateBack={handleNavigateBack}
    />
  );
};

export default ProblemDetail;
