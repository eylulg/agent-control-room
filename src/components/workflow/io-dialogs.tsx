import { useState } from 'react';
import { Button } from '@eylulg/ui/button';
import { CodeBlock } from '@eylulg/ui/code-block';
import { Dialog, DialogTrigger } from '@eylulg/ui/dialog';
import { FileDropZone } from '@eylulg/ui/file-drop-zone';
import { Textarea } from '@eylulg/ui/textarea';
import { Download, Upload } from 'lucide-react';
import { parseWorkflow, serializeWorkflow } from '@/domain/workflow/schema';
import { useEditor, useEditorStore } from '@/state/workflow-context';

const FILE_NAME = 'workflow.json';

export const ExportButton = () => {
  const store = useEditorStore();

  function handleDownload() {
    const url = URL.createObjectURL(
      new Blob([serializeWorkflow(store.getState().history.present)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = FILE_NAME;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <DialogTrigger>
      <Button variant='secondary' size='sm' iconLeading={Download}>
        Export JSON
      </Button>
      <Dialog
        title='Export workflow'
        description='The draft as JSON. Import it on this page to restore it.'
        size='lg'
        footer={({ close }) => (
          <>
            <Button variant='secondary' onPress={handleDownload}>
              Download file
            </Button>
            <Button onPress={close}>Close export</Button>
          </>
        )}
      >
        <ExportedJson />
      </Dialog>
    </DialogTrigger>
  );
};

/** Serialises the draft only while the dialog is open, so a drag does not stringify the graph on every frame. */
const ExportedJson = () => {
  const workflow = useEditor((s) => s.history.present);

  return (
    <CodeBlock label='Workflow JSON' copyable copyLabel='Copy JSON' copiedLabel='JSON copied' wrap>
      {serializeWorkflow(workflow)}
    </CodeBlock>
  );
};

export const ImportButton = () => (
  <DialogTrigger>
    <Button variant='secondary' size='sm' iconLeading={Upload}>
      Import JSON
    </Button>
    <Dialog
      title='Import workflow'
      description='Replaces the draft. You can undo it afterwards.'
      size='lg'
    >
      {({ close }) => <ImportForm onDone={close} />}
    </Dialog>
  </DialogTrigger>
);

const ImportForm = ({ onDone }: { onDone: () => void }) => {
  const store = useEditorStore();
  const [text, setText] = useState('');
  const [fileNote, setFileNote] = useState('');
  const result = text.trim() ? parseWorkflow(text) : null;

  async function handleFiles(files: File[]) {
    const file = files[0];
    if (!file) return;
    setText(await file.text());
    setFileNote(`Read ${file.name}.`);
  }

  function handleReject() {
    setFileNote('Choose a JSON file.');
  }

  function handleImport() {
    if (!result?.ok) return;
    store.getState().replace(result.workflow, 'Import workflow');
    onDone();
  }

  return (
    <div className='flex flex-col gap-4'>
      <FileDropZone
        label='Drop a JSON file here'
        hint='JSON exported from this page'
        buttonLabel='Choose a file'
        acceptedFileTypes={['.json', 'application/json']}
        onSelect={handleFiles}
        onReject={handleReject}
      />
      {fileNote && (
        <p role='status' className='text-sm text-secondary'>
          {fileNote}
        </p>
      )}
      <Textarea
        label='Or paste the JSON'
        value={text}
        onChange={setText}
        rows={8}
        font='data'
        autoCapitalize='off'
        autoCorrect='off'
        spellCheck={false}
        errorMessage={result && !result.ok ? result.error : undefined}
      />
      <div className='flex justify-end gap-2'>
        <Button variant='secondary' onPress={onDone}>
          Cancel import
        </Button>
        <Button onPress={handleImport} isDisabled={!result?.ok}>
          Import workflow
        </Button>
      </div>
    </div>
  );
};
