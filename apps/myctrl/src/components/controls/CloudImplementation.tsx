import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { CommandBlock } from '../ui/CommandBlock';
import type { CloudImplementation as CloudImplementationType, CloudProvider } from '../../data/cloud-implementations';

interface CloudImplementationProps {
  implementation: CloudImplementationType;
}

// Cloud provider icons - official SVG logos
const AwsIcon = () => (
  <svg className="w-6 h-4" viewBox="0 115 304 75" fill="#FF9900">
    <path d="M273.5,143.7c-32.9,24.3-80.7,37.2-121.8,37.2c-57.6,0-109.5-21.3-148.7-56.7c-3.1-2.8-0.3-6.6,3.4-4.4c42.4,24.6,94.7,39.5,148.8,39.5c36.5,0,76.6-7.6,113.5-23.2C274.2,133.6,278.9,139.7,273.5,143.7z"/>
    <path d="M287.2,128.1c-4.2-5.4-27.8-2.6-38.5-1.3c-3.2,0.4-3.7-2.4-0.8-4.5c18.8-13.2,49.7-9.4,53.3-5c3.6,4.5-1,35.4-18.6,50.2c-2.7,2.3-5.3,1.1-4.1-1.9C282.5,155.7,291.4,133.4,287.2,128.1z"/>
  </svg>
);

const AzureIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 32 32" fill="#0078D4" fillRule="evenodd">
    <path d="M19.867 7.282l-4.733 9.533 8.333 9.66L8 28.23l24 .25z"/>
    <path d="M18.933 3.52L8.067 12.613 0 26.223l6.867-.7z"/>
  </svg>
);

const GcpIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#4285F4">
    <path d="M12.19 2.38a9.344 9.344 0 0 0-9.234 6.893c.053-.02-.055.013 0 0-3.875 2.551-3.922 8.11-.247 10.941l.006-.007-.007.03a6.717 6.717 0 0 0 4.077 1.356h5.173l.03.03h5.192c6.687.053 9.376-8.605 3.835-12.35a9.365 9.365 0 0 0-2.821-4.552l-.043.043.006-.05A9.344 9.344 0 0 0 12.19 2.38zm-.358 4.146c1.244-.04 2.518.368 3.486 1.15a5.186 5.186 0 0 1 1.862 4.078v.518c3.53-.07 3.53 5.262 0 5.193h-5.193l-.008.009v-.04H6.785a2.59 2.59 0 0 1-1.067-.23h.001a2.597 2.597 0 1 1 3.437-3.437l3.013-3.012A6.747 6.747 0 0 0 8.11 8.24c.018-.01.04-.026.054-.023a5.186 5.186 0 0 1 3.67-1.69z"/>
  </svg>
);

const IbmIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 32 32" fill="#0530AD">
    <path d="M0 26h6.6v1.3H0zM0 23.3h6.6v1.3H0zM2.6 20.7h1.3v1.3H2.6zM0 18h6.6v1.3H0zM0 15.3h6.6v1.3H0zM2.6 12.7h1.3v1.3H2.6zM0 10h6.6v1.3H0zM0 7.3h6.6v1.3H0zM8 26h5.3v1.3H8zM9.3 23.3h2.6v1.3H9.3zM9.3 20.7h2.6v1.3H9.3zM8 18h5.3v1.3H8zM8 15.3h5.3v1.3H8zM9.3 12.7h2.6v1.3H9.3zM9.3 10h2.6v1.3H9.3zM8 7.3h5.3v1.3H8zM14.6 26h5.3v1.3h-5.3zM14.6 23.3h5.3v1.3h-5.3zM17.3 20.7h2.6v1.3h-2.6zM17.3 18h2.6v1.3h-2.6zM17.3 15.3h2.6v1.3h-2.6zM14.6 12.7h5.3v1.3h-5.3zM14.6 10h5.3v1.3h-5.3zM14.6 7.3h5.3v1.3h-5.3zM25.3 26H32v1.3h-6.7zM25.3 23.3H32v1.3h-6.7zM28 20.7h1.3v1.3H28zM25.3 18H32v1.3h-6.7zM25.3 15.3H32v1.3h-6.7zM28 12.7h1.3v1.3H28zM25.3 10H32v1.3h-6.7zM25.3 7.3H32v1.3h-6.7z"/>
  </svg>
);

const OciIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#C74634">
    <path d="M7.2 4.8A7.2 7.2 0 0 0 0 12a7.2 7.2 0 0 0 7.2 7.2h9.6A7.2 7.2 0 0 0 24 12a7.2 7.2 0 0 0-7.2-7.2H7.2zm0 2.4h9.6a4.8 4.8 0 0 1 4.8 4.8 4.8 4.8 0 0 1-4.8 4.8H7.2A4.8 4.8 0 0 1 2.4 12a4.8 4.8 0 0 1 4.8-4.8z"/>
  </svg>
);

const ExternalLinkIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
  </svg>
);

function ProviderTab({ provider, name }: { provider: CloudProvider; name: string }) {
  return (
    <div className="space-y-4">
      {/* Services */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-2">Related Services</h4>
        <div className="flex flex-wrap gap-2">
          {provider.services.map((service, i) => (
            <Badge key={i} variant="outline" className="font-mono text-xs">
              {service}
            </Badge>
          ))}
        </div>
      </div>

      {/* CLI Commands - Individual blocks for each command */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-2">CLI Commands</h4>
        <div className="space-y-3">
          {provider.cli.map((cmd, i) => (
            <CommandBlock key={i} command={cmd.command} description={cmd.description} />
          ))}
        </div>
      </div>

      {/* Links */}
      <div className="flex flex-wrap gap-3 pt-2">
        {provider.console && (
          <a
            href={provider.console}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            Open {name} Console
            <ExternalLinkIcon />
          </a>
        )}
        {provider.docs && (
          <a
            href={provider.docs}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            Documentation
            <ExternalLinkIcon />
          </a>
        )}
      </div>
    </div>
  );
}

const gridColsClass: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
};

const providers = [
  { key: 'aws', label: 'AWS', Icon: AwsIcon },
  { key: 'azure', label: 'Azure', Icon: AzureIcon },
  { key: 'gcp', label: 'GCP', Icon: GcpIcon },
  { key: 'ibm', label: 'IBM Cloud', Icon: IbmIcon },
  { key: 'oci', label: 'OCI', Icon: OciIcon },
] as const;

export function CloudImplementation({ implementation }: CloudImplementationProps) {
  const available = providers.filter(p => implementation[p.key]);

  if (available.length === 0) {
    return null;
  }

  const defaultTab = available[0].key;
  const colsClass = gridColsClass[available.length];

  return (
    <Card className="p-4 sm:p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <span className="text-primary font-mono">{'>'}</span>
            Programmatic Queries
          </h3>
        </div>

        <Tabs defaultValue={defaultTab}>
          <TabsList className={`grid w-full ${colsClass} max-w-xl`}>
            {available.map(({ key, label, Icon }) => (
              <TabsTrigger key={key} value={key} className="flex items-center gap-2">
                <Icon />
                <span className="hidden sm:inline">{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {available.map(({ key, label }) => (
            <TabsContent key={key} value={key}>
              <ProviderTab provider={implementation[key]!} name={label} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </Card>
  );
}
