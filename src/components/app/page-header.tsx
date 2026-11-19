import { type ReactNode, useEffect } from 'react';
import { PageHeader as Header } from '@eylulg/ui/page-header';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}

/** The library page header, plus the document title that goes with the page. */
export const PageHeader = ({ title, description, actions }: PageHeaderProps) => {
  useEffect(() => {
    document.title = `${title} | Agent workflows`;
  }, [title]);

  return <Header title={title} description={description} actions={actions} />;
};
