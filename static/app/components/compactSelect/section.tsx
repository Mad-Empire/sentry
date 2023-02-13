import {Fragment, useCallback, useContext, useMemo} from 'react';
import styled from '@emotion/styled';
import {AriaListBoxSectionProps, useListBoxSection} from '@react-aria/listbox';
import {useSeparator} from '@react-aria/separator';
import {ListState} from '@react-stately/list';
import {Node} from '@react-types/shared';

import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {FormSize} from 'sentry/utils/theme';

import {SelectContext} from './control';
import {toggleOptions} from './listBox';
import {Option} from './option';

interface SectionProps extends AriaListBoxSectionProps {
  item: Node<any>;
  /**
   * (To be passed to Option.) Whether the list box (ul element) has focus. If not (e.g.
   * if the search input has focus), then Option will not have any focus effect.
   */
  listBoxHasFocus: boolean;
  listState: ListState<any>;
  size: FormSize;
}

/**
 * A <li /> element that functions as a list box section (renders a nested <ul />
 * inside). https://react-spectrum.adobe.com/react-aria/useListBox.html
 */
export function Section({item, listState, listBoxHasFocus, size}: SectionProps) {
  const {itemProps, headingProps, groupProps} = useListBoxSection({
    heading: item.rendered,
    'aria-label': item['aria-label'],
  });

  const {separatorProps} = useSeparator({elementType: 'li'});

  const {filterOption} = useContext(SelectContext);
  const filteredOptions = useMemo(() => {
    return [...item.childNodes].filter(child => {
      return filterOption(child.props);
    });
  }, [item.childNodes, filterOption]);

  /**
   * Whether all options in this section are selected
   */
  const allOptionsSelected = useMemo(
    () => filteredOptions.every(opt => listState.selectionManager.isSelected(opt.key)),
    [filteredOptions, listState.selectionManager]
  );

  /**
   * Whether one of the options in this section has focus
   */
  const sectionHasFocus = useMemo(
    () => filteredOptions.some(opt => listState.selectionManager.focusedKey === opt.key),
    [filteredOptions, listState.selectionManager.focusedKey]
  );

  const toggleAllOptions = useCallback(
    () =>
      toggleOptions(
        filteredOptions.map(opt => opt.key),
        listState.selectionManager
      ),
    [filteredOptions, listState.selectionManager]
  );

  return (
    <Fragment>
      <Separator {...separatorProps} />
      <SectionWrap {...itemProps} data-key={item.key}>
        {(item.rendered || item.value.showToggleAllButton) && (
          <SectionHeader>
            {item.rendered && (
              <SectionTitle {...headingProps}>{item.rendered}</SectionTitle>
            )}
            {listState.selectionManager.selectionMode === 'multiple' &&
              item.value.showToggleAllButton && (
                <ToggleAllButton
                  size="zero"
                  borderless
                  // Remove this button from keyboard navigation and the accessibility tree,
                  // since the outer list box implements a roving `tabindex` system that
                  // would be messed up if there was a focusable, non-selectable button in
                  // the middle of it. Keyboard users will still be able to toggle-select
                  // sections with hidden buttons at the end of the list box (see
                  // `HiddenSectionToggle` in './listBox.tsx')
                  aria-hidden
                  tabIndex={-1}
                  onClick={toggleAllOptions}
                  visible={listBoxHasFocus && sectionHasFocus}
                >
                  {allOptionsSelected ? t('Unselect All') : t('Select All')}
                </ToggleAllButton>
              )}
          </SectionHeader>
        )}
        <SectionGroup {...groupProps}>
          {filteredOptions.map(child => (
            <Option
              key={child.key}
              item={child}
              listState={listState}
              listBoxHasFocus={listBoxHasFocus}
              size={size}
            />
          ))}
        </SectionGroup>
      </SectionWrap>
    </Fragment>
  );
}

const Separator = styled('li')`
  list-style-type: none;
  border-top: solid 1px ${p => p.theme.innerBorder};
  margin: ${space(0.5)} ${space(1.5)};

  &:first-of-type {
    display: none;
  }
`;

const SectionWrap = styled('li')`
  list-style-type: none;
`;

const SectionHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-sizing: content-box;
  height: 1.5em;
  padding: ${space(0.25)} ${space(1.5)};
`;

const SectionTitle = styled('p')`
  display: inline-block;
  font-weight: 600;
  font-size: ${p => p.theme.fontSizeExtraSmall};
  color: ${p => p.theme.subText};
  text-transform: uppercase;
  white-space: nowrap;

  margin: 0;
  padding-right: ${space(4)};
`;

const ToggleAllButton = styled(Button)<{visible: boolean}>`
  font-size: inherit; /* Inherit font size from MenuHeader */
  color: ${p => p.theme.subText};
  padding: 0 ${space(0.5)};
  margin: 0 -${space(0.5)} 0 ${space(2)};

  font-weight: 400;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};

  transition: opacity 0.1s;
  opacity: ${p => (p.visible ? 1 : 0)};

  &.focus-visible {
    opacity: 1;
  }
`;

const SectionGroup = styled('ul')`
  margin: 0;
  padding: 0;
`;
