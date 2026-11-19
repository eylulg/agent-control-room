import { type ComponentType, type ReactNode, useState } from 'react';
import { cx } from '@eylulg/ui/cx';
import { Popover } from '@eylulg/ui/popover';
import { ArrowLeft, Copy, Link2, Settings2, Trash2, Unlink } from 'lucide-react';
import { Header, Menu, MenuItem, MenuSection, Separator } from 'react-aria-components';
import { validTargets } from '@/domain/workflow/ops';
import { PORTS } from '@/domain/workflow/types';
import { useEditor, useEditorStore } from '@/state/workflow-context';
import { nodeDomId } from './geometry';

// A menu opened from the keyboard starts on its first item. The rule against autoFocus is about pages that grab focus on load.
const OPEN_ON_FIRST = { autoFocus: 'first' } as const;

/**
 * The keyboard and screen reader path for everything a pointer does to a node: connect, disconnect, duplicate, delete.
 * It opens on Enter, the context menu key or Shift+F10 on a node, and returns focus to the node when it closes.
 */
export const NodeMenu = () => {
  const menu = useEditor((s) => s.menu);
  return menu ? <OpenMenu key={menu.nodeId} nodeId={menu.nodeId} view={menu.view} /> : null;
};

const OpenMenu = ({
  nodeId,
  view,
}: {
  nodeId: string;
  view: 'root' | 'connect' | 'disconnect';
}) => {
  const store = useEditorStore();
  const workflow = useEditor((s) => s.history.present);
  const selected = useEditor((s) => s.selected);
  // The menu mounts only while it is open, from a step that exists, so the step's element is there when this first renders.
  const [anchor] = useState(() => document.getElementById(nodeDomId(nodeId)));
  const names = useEditor((s) => s.analysis.names);
  const node = workflow.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) return null;
  const nameOf = (id: string) => names[id] ?? id;
  const title = nameOf(node.id);

  // Actions apply to the whole selection when the menu was opened on a selected node.
  const targets = selected.includes(node.id) ? selected : [node.id];
  const outgoing = workflow.edges.filter((edge) => edge.from.node === node.id);
  const many = targets.length > 1;

  function handleOpenChange(open: boolean) {
    if (!open) store.getState().closeMenu();
  }

  function act(run: () => void) {
    store.getState().closeMenu();
    run();
  }

  function handleRootAction(key: string | number) {
    const state = store.getState();
    if (key === 'connect') return state.setMenuView('connect');
    if (key === 'disconnect') return state.setMenuView('disconnect');
    if (key === 'settings') return act(() => state.requestInspector(nodeId));
    if (key === 'duplicate') return act(() => state.duplicate(targets));
    if (key === 'delete') return act(() => state.deleteIds(targets));
  }

  function handleConnectAction(key: string | number) {
    const state = store.getState();
    if (key === 'back') return state.setMenuView('root');
    const [portId, targetId] = String(key).split('|');
    if (portId && targetId) act(() => state.connect(node?.id ?? '', portId, targetId));
  }

  function handleDisconnectAction(key: string | number) {
    const state = store.getState();
    if (key === 'back') return state.setMenuView('root');
    act(() => state.disconnectEdge(String(key)));
  }

  return (
    <Popover
      isOpen
      onOpenChange={handleOpenChange}
      triggerRef={{ current: anchor }}
      placement='bottom start'
      aria-label={`Actions for ${title}`}
    >
      {view === 'root' && (
        <Menu
          aria-label={`Actions for ${title}`}
          {...OPEN_ON_FIRST}
          onAction={handleRootAction}
          className='flex flex-col outline-none'
        >
          <Item id='connect' icon={Link2} textValue='Connect to'>
            Connect to…
          </Item>
          <Item
            id='disconnect'
            icon={Unlink}
            isDisabled={workflow.edges.every(
              (edge) => edge.from.node !== node.id && edge.to !== node.id,
            )}
            textValue='Disconnect'
          >
            Disconnect…
          </Item>
          <Item id='settings' icon={Settings2} textValue='Edit settings'>
            Edit settings
          </Item>
          <Item
            id='duplicate'
            icon={Copy}
            isDisabled={targets.every(
              (id) => workflow.nodes.find((n) => n.id === id)?.type === 'trigger',
            )}
            textValue='Duplicate'
          >
            {many ? `Duplicate ${targets.length} steps` : 'Duplicate'}
          </Item>
          <Divider />
          <Item id='delete' icon={Trash2} isDanger textValue='Delete'>
            {many ? `Delete ${targets.length} steps` : 'Delete'}
          </Item>
        </Menu>
      )}
      {view === 'connect' && (
        <Menu
          aria-label={`Connect ${title} to`}
          {...OPEN_ON_FIRST}
          onAction={handleConnectAction}
          className='flex max-h-72 flex-col outline-none'
        >
          <Item id='back' icon={ArrowLeft} textValue='Back'>
            Back
          </Item>
          <Divider />
          {PORTS[node.type].length === 0 && (
            <Item isDisabled textValue='No output ports'>
              This step has no output to connect
            </Item>
          )}
          {PORTS[node.type].map((port) => (
            <Section
              key={port.id}
              title={PORTS[node.type].length > 1 ? `${port.label} port` : 'Next step'}
            >
              {validTargets(workflow, node.id, port.id).map((target) => (
                <Item
                  key={target.id}
                  id={`${port.id}|${target.id}`}
                  textValue={`${port.label} to ${nameOf(target.id)}`}
                >
                  {nameOf(target.id)}
                </Item>
              ))}
            </Section>
          ))}
        </Menu>
      )}
      {view === 'disconnect' && (
        <Menu
          aria-label={`Disconnect ${title}`}
          {...OPEN_ON_FIRST}
          onAction={handleDisconnectAction}
          className='flex flex-col outline-none'
        >
          <Item id='back' icon={ArrowLeft} textValue='Back'>
            Back
          </Item>
          <Divider />
          {workflow.edges
            .filter((edge) => edge.from.node === node.id || edge.to === node.id)
            .map((edge) => {
              const port = PORTS[
                workflow.nodes.find((n) => n.id === edge.from.node)?.type ?? 'end'
              ].find((p) => p.id === edge.from.port);
              const text = `${nameOf(edge.from.node)} ${port?.label ?? edge.from.port} to ${nameOf(edge.to)}`;
              return (
                <Item key={edge.id} id={edge.id} textValue={text}>
                  {text}
                </Item>
              );
            })}
          {outgoing.length === 0 && workflow.edges.every((edge) => edge.to !== node.id) && (
            <Item isDisabled textValue='Nothing connected'>
              Nothing is connected
            </Item>
          )}
        </Menu>
      )}
    </Popover>
  );
};

// The library's DropdownMenu parts load only inside its own MenuTrigger, so this menu, which opens from a node, uses the same tokens directly.
const itemClass =
  'flex cursor-pointer items-center gap-2 rounded-sm px-item-x py-item-y text-sm text-primary outline-none select-none data-focused:bg-hover data-focus-visible:outline-2 data-focus-visible:-outline-offset-2 data-focus-visible:outline-focus data-disabled:cursor-not-allowed data-disabled:text-disabled';

interface ItemProps {
  id?: string;
  icon?: ComponentType<{ className?: string; 'aria-hidden'?: 'true' }>;
  isDanger?: boolean;
  isDisabled?: boolean;
  textValue: string;
  children: ReactNode;
}

const Item = ({ icon: Icon, isDanger, children, ...props }: ItemProps) => (
  <MenuItem {...props} className={cx(itemClass, isDanger && 'text-error')}>
    {Icon && (
      <Icon
        aria-hidden='true'
        className={cx('size-4 shrink-0', isDanger ? 'text-fg-error' : 'text-fg-tertiary')}
      />
    )}
    {children}
  </MenuItem>
);

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <MenuSection className='flex flex-col'>
    <Header className='px-item-x py-1 text-xs font-semibold text-tertiary'>{title}</Header>
    {children}
  </MenuSection>
);

const Divider = () => <Separator className='mx-1 my-1 h-px bg-(--ui-border-subtle)' />;
