import ProblemView from '../components/ProblemView.js';

/**
 * 現在Ankiで表示されている問題を表示するページ
 */
const CurrentProblem = () => {
  return (
    <>
      <ProblemView 
        isCurrentCard={true}
      />
      
    </>
  );
};

export default CurrentProblem;
