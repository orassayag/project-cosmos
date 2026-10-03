import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Cluster, Service } from '../../api/cosmos-api';
import { indexCosmos } from '../../api/cosmosIndex';
import { COSMOS_FIXTURE } from '../../__tests__/renderWithCosmos';
import { ClusterBackdrop } from '../ClusterBackdrop';

const CLUSTERS = COSMOS_FIXTURE.data.clusters;
const SERVICES_BY_ID = indexCosmos(COSMOS_FIXTURE).servicesById;

function renderBackdrop(cluster: Cluster, servicesById: Record<string, Service>) {
  return render(
    <svg>
      <ClusterBackdrop cluster={cluster} servicesById={servicesById} palette={COSMOS_FIXTURE.data.palette} />
    </svg>,
  );
}

describe('ClusterBackdrop', () => {
  it('draws a renamed member from data alone, with no client code naming it', () => {
    const [shippedCluster] = CLUSTERS;
    const [originalId] = shippedCluster.serviceIds;
    const renamedService: Service = { ...SERVICES_BY_ID[originalId], id: 'renamed-member', x: 500, y: 400 };
    const cluster: Cluster = { ...shippedCluster, serviceIds: ['renamed-member'] };

    const { container } = renderBackdrop(cluster, { 'renamed-member': renamedService });

    const backdrop = container.querySelector(`[data-cluster-id="${cluster.id}"]`);
    expect(backdrop).not.toBeNull();
    const wash = backdrop!.querySelector('ellipse');
    expect(wash?.getAttribute('cx')).toBe('500');
    expect(wash?.getAttribute('cy')).toBe('400');
    expect(backdrop!.textContent).toBe(cluster.label.toUpperCase());
  });

  it('draws an unknown cluster with a look built from its nebula hues', () => {
    const service = SERVICES_BY_ID[CLUSTERS[0].serviceIds[0]];
    const cluster: Cluster = {
      id: 'new-zone',
      label: 'New zone',
      serviceIds: [service.id],
      nebula: { anchorServiceIds: [service.id], base: 'teal', hot: 'rose' },
    };

    const { container } = renderBackdrop(cluster, { [service.id]: service });

    const stops = [...container.querySelectorAll('#cosmos-new-zone-cluster stop')].map((stop) => stop.getAttribute('stop-color'));
    expect(stops).toEqual(['#38bdf8', '#ec4899', '#38bdf8', '#38bdf8']);
  });

  it('renders nothing when none of its services exist', () => {
    const { container } = renderBackdrop({ ...CLUSTERS[0], serviceIds: ['gone'] }, {});
    expect(container.querySelector('[data-cluster-id]')).toBeNull();
  });
});
