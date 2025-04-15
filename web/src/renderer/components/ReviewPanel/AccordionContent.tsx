import { AccordionContentProps } from './types';

const AccordionContent = ({ isAccordionOpen, children }: AccordionContentProps) => {
  return (
    <div
      className={`flex-grow transition-all duration-300 ease-in-out ${
        isAccordionOpen ? 'max-h-[calc(100vh-120px)] opacity-100 p-4' : 'max-h-0 opacity-0'
      }`}
    >
      {children}
    </div>
  );
};

export default AccordionContent;
