import TimeSince from 'sentry/components/timeSince';
import Tooltip from 'sentry/components/tooltip';

export default {
  title: 'Components/Time Since',
  component: Tooltip,
};

export const _TimeSince = args => {
  return <TimeSince {...args} />;
};

_TimeSince.args = {
  date: new Date('Oct 31, 2020 9:00:00 PM UTC'),
  disabledAbsoluteTooltip: false,
  extraShort: false,
  shorten: false,
  suffix: '',
  tooltipShowSeconds: false,
  tooltipTitle: null,
  tooltipUnderlineColor: 'black',
};
_TimeSince.argTypes = {
  date: {
    control: 'date',
  },
  tooltipUnderlineColor: {
    control: 'select',
    options: [
      'black',
      'white',
      'surface100',
      'surface200',
      'surface300',
      'surface400',
      'gray500',
      'gray400',
      'gray300',
      'gray200',
      'gray100',
      'translucentGray200',
      'translucentGray100',
      'purple400',
      'purple300',
      'purple200',
      'purple100',
      'blue400',
      'blue300',
      'blue200',
      'blue100',
      'green400',
      'green300',
      'green200',
      'green100',
      'yellow400',
      'yellow300',
      'yellow200',
      'yellow100',
      'red400',
      'red300',
      'red200',
      'red100',
      'pink400',
      'pink300',
      'pink200',
      'pink100',
      'active',
      'activeHover',
      'activeText',
      'background',
      'backgroundElevated',
      'backgroundSecondary',
      'bannerBackground',
      'bodyBackground',
      'border',
      'buttonCount',
      'buttonCountActive',
      'chartLabel',
      'chartLineColor',
      'chartOther',
      'disabled',
      'disabledBorder',
      'error',
      'errorText',
      'focus',
      'focusBorder',
      'formInputBorder',
      'formPlaceholder',
      'formText',
      'headerBackground',
      'headingColor',
      'hover',
      'inactive',
      'innerBorder',
      'linkColor',
      'linkFocus',
      'linkHoverColor',
      'linkUnderline',
      'overlayBackgroundAlpha',
      'progressBackground',
      'progressBar',
      'rowBackground',
      'searchTokenBackground',
      'searchTokenBorder',
      'subText',
      'success',
      'successText',
      'tagBar',
      'tagBarHover',
      'textColor',
      'translucentBorder',
      'translucentInnerBorder',
    ],
  },
};
