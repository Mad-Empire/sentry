import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SwitchOrganization} from 'sentry/components/sidebar/sidebarDropdown/switchOrganization';
import {Organization} from 'sentry/types';
import {OrganizationContext} from 'sentry/views/organizationContext';

describe('SwitchOrganization', function () {
  function mountWithOrg(children, organization?: Organization) {
    if (!organization) {
      organization = TestStubs.Organization() as Organization;
    }
    return (
      <OrganizationContext.Provider value={organization}>
        {children}
      </OrganizationContext.Provider>
    );
  }

  it('can list organizations', function () {
    jest.useFakeTimers();
    render(
      mountWithOrg(
        <SwitchOrganization
          canCreateOrganization={false}
          organizations={[
            TestStubs.Organization({name: 'Organization 1'}),
            TestStubs.Organization({name: 'Organization 2', slug: 'org2'}),
          ]}
        />
      )
    );

    userEvent.hover(screen.getByTestId('sidebar-switch-org'));
    act(() => void jest.advanceTimersByTime(500));

    expect(screen.getByRole('list')).toBeInTheDocument();

    expect(screen.getByText('Organization 1')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'org slug Organization 1'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/'
    );

    expect(screen.getByText('Organization 2')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'org2 Organization 2'})).toHaveAttribute(
      'href',
      '/organizations/org2/'
    );

    jest.useRealTimers();
  });

  it('uses organizationUrl when customer domain is enabled', function () {
    jest.useFakeTimers();
    render(
      mountWithOrg(
        <SwitchOrganization
          canCreateOrganization={false}
          organizations={[
            TestStubs.Organization({name: 'Organization 1', slug: 'org1'}),
            TestStubs.Organization({
              name: 'Organization 2',
              slug: 'org2',
              links: {
                organizationUrl: 'http://org2.sentry.io',
                regionUrl: 'http://eu.sentry.io',
              },
              features: ['customer-domains'],
            }),
          ]}
        />
      )
    );

    userEvent.hover(screen.getByTestId('sidebar-switch-org'));
    act(() => void jest.advanceTimersByTime(500));

    expect(screen.getByRole('list')).toBeInTheDocument();

    const org1Link = screen.getByRole('link', {name: 'org1 Organization 1'});
    expect(org1Link).toBeInTheDocument();
    expect(org1Link).toHaveAttribute('href', '/organizations/org1/');

    const org2Link = screen.getByRole('link', {name: 'org2 Organization 2'});
    expect(org2Link).toBeInTheDocument();
    expect(org2Link).toHaveAttribute('href', 'http://org2.sentry.io');
    jest.useRealTimers();
  });

  it('does not use organizationUrl when customer domain is disabled', function () {
    jest.useFakeTimers();
    render(
      mountWithOrg(
        <SwitchOrganization
          canCreateOrganization={false}
          organizations={[
            TestStubs.Organization({name: 'Organization 1', slug: 'org1'}),
            TestStubs.Organization({
              name: 'Organization 2',
              slug: 'org2',
              links: {
                organizationUrl: 'http://org2.sentry.io',
                regionUrl: 'http://eu.sentry.io',
              },
              features: [],
            }),
          ]}
        />
      )
    );

    userEvent.hover(screen.getByTestId('sidebar-switch-org'));
    act(() => void jest.advanceTimersByTime(500));

    expect(screen.getByRole('list')).toBeInTheDocument();

    const org1Link = screen.getByRole('link', {name: 'org1 Organization 1'});
    expect(org1Link).toBeInTheDocument();
    expect(org1Link).toHaveAttribute('href', '/organizations/org1/');

    const org2Link = screen.getByRole('link', {name: 'org2 Organization 2'});
    expect(org2Link).toBeInTheDocument();
    expect(org2Link).toHaveAttribute('href', '/organizations/org2/');
    jest.useRealTimers();
  });

  it('uses sentryUrl when current org has customer domain enabled', function () {
    jest.useFakeTimers();
    const org2 = TestStubs.Organization({
      name: 'Organization 2',
      slug: 'org2',
      links: {
        organizationUrl: 'http://org2.sentry.io',
        regionUrl: 'http://eu.sentry.io',
      },
      features: ['customer-domains'],
    });
    render(
      mountWithOrg(
        <SwitchOrganization
          canCreateOrganization={false}
          organizations={[
            TestStubs.Organization({name: 'Organization 1', slug: 'org1'}),
            org2,
          ]}
        />,
        org2
      )
    );

    userEvent.hover(screen.getByTestId('sidebar-switch-org'));
    act(() => void jest.advanceTimersByTime(500));

    expect(screen.getByRole('list')).toBeInTheDocument();

    const org1Link = screen.getByRole('link', {name: 'org1 Organization 1'});
    expect(org1Link).toBeInTheDocument();
    // Current hostname in the URL is expected to be org2.sentry.io, so we need to make use of sentryUrl to link to an
    // organization that does not support customer domains.
    expect(org1Link).toHaveAttribute('href', 'https://sentry.io/organizations/org1/');

    const org2Link = screen.getByRole('link', {name: 'org2 Organization 2'});
    expect(org2Link).toBeInTheDocument();
    expect(org2Link).toHaveAttribute('href', 'http://org2.sentry.io');
    jest.useRealTimers();
  });

  it('does not use sentryUrl when current org does not have customer domain feature', function () {
    jest.useFakeTimers();
    const org2 = TestStubs.Organization({
      name: 'Organization 2',
      slug: 'org2',
      links: {
        organizationUrl: 'http://org2.sentry.io',
        regionUrl: 'http://eu.sentry.io',
      },
      features: [],
    });
    render(
      mountWithOrg(
        <SwitchOrganization
          canCreateOrganization={false}
          organizations={[
            TestStubs.Organization({name: 'Organization 1', slug: 'org1'}),
            TestStubs.Organization({
              name: 'Organization 3',
              slug: 'org3',
              links: {
                organizationUrl: 'http://org3.sentry.io',
                regionUrl: 'http://eu.sentry.io',
              },
              features: ['customer-domains'],
            }),
          ]}
        />,
        org2
      )
    );

    userEvent.hover(screen.getByTestId('sidebar-switch-org'));
    act(() => void jest.advanceTimersByTime(500));

    expect(screen.getByRole('list')).toBeInTheDocument();

    const org1Link = screen.getByRole('link', {name: 'org1 Organization 1'});
    expect(org1Link).toBeInTheDocument();
    expect(org1Link).toHaveAttribute('href', '/organizations/org1/');

    const org3Link = screen.getByRole('link', {name: 'org3 Organization 3'});
    expect(org3Link).toBeInTheDocument();
    expect(org3Link).toHaveAttribute('href', 'http://org3.sentry.io');
    jest.useRealTimers();
  });

  it('shows "Create an Org" if they have permission', function () {
    jest.useFakeTimers();
    render(mountWithOrg(<SwitchOrganization canCreateOrganization organizations={[]} />));

    userEvent.hover(screen.getByTestId('sidebar-switch-org'));
    act(() => void jest.advanceTimersByTime(500));

    expect(screen.getByTestId('sidebar-create-org')).toBeInTheDocument();
    jest.useRealTimers();
  });

  it('does not have "Create an Org" if they do not have permission', function () {
    jest.useFakeTimers();
    render(
      mountWithOrg(
        <SwitchOrganization canCreateOrganization={false} organizations={[]} />
      )
    );

    userEvent.hover(screen.getByTestId('sidebar-switch-org'));
    act(() => void jest.advanceTimersByTime(500));

    expect(screen.queryByTestId('sidebar-create-org')).not.toBeInTheDocument();
    jest.useRealTimers();
  });

  it('shows orgs pending deletion with a special icon', function () {
    const orgPendingDeletion = TestStubs.Organization({
      slug: 'org-2',
      status: {id: 'pending_deletion', name: 'pending_deletion'},
    });

    jest.useFakeTimers();
    render(
      mountWithOrg(
        <SwitchOrganization
          canCreateOrganization
          organizations={[TestStubs.Organization(), orgPendingDeletion]}
        />
      )
    );

    userEvent.hover(screen.getByTestId('sidebar-switch-org'));
    act(() => void jest.advanceTimersByTime(500));

    expect(screen.getByTestId('pending-deletion-icon')).toBeInTheDocument();
    jest.useRealTimers();
  });
});
