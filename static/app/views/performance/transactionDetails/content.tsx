import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';

import AsyncComponent from 'sentry/components/asyncComponent';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import NotFound from 'sentry/components/errors/notFound';
import {BorderlessEventEntries} from 'sentry/components/events/eventEntries';
import EventMetadata from 'sentry/components/events/eventMetadata';
import EventVitals from 'sentry/components/events/eventVitals';
import * as SpanEntryContext from 'sentry/components/events/interfaces/spans/context';
import RootSpanStatus from 'sentry/components/events/rootSpanStatus';
import FileSize from 'sentry/components/fileSize';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import TagsTable from 'sentry/components/tagsTable';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {Event, EventTag} from 'sentry/types/event';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import {formatTagKey} from 'sentry/utils/discover/fields';
import * as QuickTraceContext from 'sentry/utils/performance/quickTrace/quickTraceContext';
import QuickTraceQuery from 'sentry/utils/performance/quickTrace/quickTraceQuery';
import TraceMetaQuery from 'sentry/utils/performance/quickTrace/traceMetaQuery';
import {getTraceTimeRangeFromEvent} from 'sentry/utils/performance/quickTrace/utils';
import Projects from 'sentry/utils/projects';
import {appendTagCondition, decodeScalar} from 'sentry/utils/queryString';
import Breadcrumb from 'sentry/views/performance/breadcrumb';

import {transactionSummaryRouteWithQuery} from '../transactionSummary/utils';
import {getTransactionDetailsUrl} from '../utils';

import EventMetas from './eventMetas';

type Props = Pick<
  RouteComponentProps<{eventSlug: string}, {}>,
  'params' | 'location' | 'router' | 'route'
> & {
  organization: Organization;
  eventSlug: string;
};

type State = {
  event: Event | undefined;
  isSidebarVisible: boolean;
} & AsyncComponent['state'];

class EventDetailsContent extends AsyncComponent<Props, State> {
  state: State = {
    // AsyncComponent state
    loading: true,
    reloading: false,
    error: false,
    errors: {},
    event: undefined,

    // local state
    isSidebarVisible: true,
  };

  toggleSidebar = () => {
    this.setState({isSidebarVisible: !this.state.isSidebarVisible});
  };

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, params} = this.props;
    const {eventSlug} = params;

    const url = `/organizations/${organization.slug}/events/${eventSlug}/`;

    return [['event', url]];
  }

  get projectId() {
    return this.props.eventSlug.split(':')[0];
  }

  generateTagUrl = (tag: EventTag) => {
    const {location, organization} = this.props;
    const {event} = this.state;
    if (!event) {
      return '';
    }
    const query = decodeScalar(location.query.query, '');
    const newQuery = {
      ...location.query,
      query: appendTagCondition(query, formatTagKey(tag.key), tag.value),
    };
    return transactionSummaryRouteWithQuery({
      orgSlug: organization.slug,
      transaction: event.title,
      projectID: event.projectID,
      query: newQuery,
    });
  };

  renderBody() {
    const {event} = this.state;

    if (!event) {
      return <NotFound />;
    }

    return this.renderContent(event);
  }

  renderContent(event: Event) {
    const {organization, location, eventSlug, route, router} = this.props;

    // metrics
    trackAnalyticsEvent({
      eventKey: 'performance.event_details',
      eventName: 'Performance: Opened Event Details',
      event_type: event.type,
      organization_id: parseInt(organization.id, 10),
    });

    const {isSidebarVisible} = this.state;
    const transactionName = event.title;
    const query = decodeScalar(location.query.query, '');

    const eventJsonUrl = `/api/0/projects/${organization.slug}/${this.projectId}/events/${event.eventID}/json/`;
    const traceId = event.contexts?.trace?.trace_id ?? '';
    const {start, end} = getTraceTimeRangeFromEvent(event);

    return (
      <TraceMetaQuery
        location={location}
        orgSlug={organization.slug}
        traceId={traceId}
        start={start}
        end={end}
      >
        {metaResults => (
          <QuickTraceQuery event={event} location={location} orgSlug={organization.slug}>
            {results => (
              <Fragment>
                <Layout.Header>
                  <Layout.HeaderContent>
                    <Breadcrumb
                      organization={organization}
                      location={location}
                      transaction={{
                        project: event.projectID,
                        name: transactionName,
                      }}
                      eventSlug={eventSlug}
                    />
                    <Layout.Title data-test-id="event-header">{event.title}</Layout.Title>
                  </Layout.HeaderContent>
                  <Layout.HeaderActions>
                    <ButtonBar gap={1}>
                      <Button onClick={this.toggleSidebar}>
                        {isSidebarVisible ? 'Hide Details' : 'Show Details'}
                      </Button>
                      {results && (
                        <Button icon={<IconOpen />} href={eventJsonUrl} external>
                          {t('JSON')} (<FileSize bytes={event.size} />)
                        </Button>
                      )}
                    </ButtonBar>
                  </Layout.HeaderActions>
                </Layout.Header>
                <Layout.Body>
                  {results && (
                    <Layout.Main fullWidth>
                      <EventMetas
                        quickTrace={results}
                        meta={metaResults?.meta ?? null}
                        event={event}
                        organization={organization}
                        projectId={this.projectId}
                        location={location}
                        errorDest="issue"
                        transactionDest="performance"
                      />
                    </Layout.Main>
                  )}
                  <Layout.Main fullWidth={!isSidebarVisible}>
                    <Projects orgId={organization.slug} slugs={[this.projectId]}>
                      {({projects}) => (
                        <SpanEntryContext.Provider
                          value={{
                            getViewChildTransactionTarget: childTransactionProps => {
                              return getTransactionDetailsUrl(
                                organization,
                                childTransactionProps.eventSlug,
                                childTransactionProps.transaction,
                                location.query
                              );
                            },
                          }}
                        >
                          <QuickTraceContext.Provider value={results}>
                            <BorderlessEventEntries
                              organization={organization}
                              event={event}
                              project={projects[0] as Project}
                              showExampleCommit={false}
                              showTagSummary={false}
                              location={location}
                              api={this.api}
                              router={router}
                              route={route}
                              isBorderless
                            />
                          </QuickTraceContext.Provider>
                        </SpanEntryContext.Provider>
                      )}
                    </Projects>
                  </Layout.Main>
                  {isSidebarVisible && (
                    <Layout.Side>
                      {results === undefined && (
                        <Fragment>
                          <EventMetadata
                            event={event}
                            organization={organization}
                            projectId={this.projectId}
                          />
                          <RootSpanStatus event={event} />
                        </Fragment>
                      )}
                      <EventVitals event={event} />
                      <TagsTable
                        event={event}
                        query={query}
                        generateUrl={this.generateTagUrl}
                      />
                    </Layout.Side>
                  )}
                </Layout.Body>
              </Fragment>
            )}
          </QuickTraceQuery>
        )}
      </TraceMetaQuery>
    );
  }

  renderError(error: Error) {
    const notFound = Object.values(this.state.errors).find(
      resp => resp && resp.status === 404
    );
    const permissionDenied = Object.values(this.state.errors).find(
      resp => resp && resp.status === 403
    );

    if (notFound) {
      return <NotFound />;
    }
    if (permissionDenied) {
      return (
        <LoadingError message={t('You do not have permission to view that event.')} />
      );
    }

    return super.renderError(error, true, true);
  }

  renderComponent() {
    const {organization} = this.props;

    return (
      <SentryDocumentTitle
        title={t('Performance - Event Details')}
        orgSlug={organization.slug}
      >
        {super.renderComponent()}
      </SentryDocumentTitle>
    );
  }
}

export default EventDetailsContent;
