export const COMPONENT_NAME = 'ShaderGradientBackground';

const DIRECTORY = 'src/feega';
const CLIENT_DIRECTIVE = "'use client';\n\n";

export const componentFile = (typescript: boolean) => `${DIRECTORY}/${COMPONENT_NAME}.${typescript ? 'tsx' : 'jsx'}`;

export const componentSource = (typescript: boolean, clientDirective: boolean) => `${clientDirective ? CLIENT_DIRECTIVE : ''}import { ShaderGradient, ShaderGradientCanvas${typescript ? ', type GradientT' : ''} } from '@shadergradient/react';

export default function ${COMPONENT_NAME}(props${typescript ? ': GradientT' : ''}) {
  return (
    <ShaderGradientCanvas style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <ShaderGradient control="props" {...props} />
    </ShaderGradientCanvas>
  );
}
`;
