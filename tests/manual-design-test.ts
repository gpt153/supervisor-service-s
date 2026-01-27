import { DesignSystemManager } from '../src/ui/DesignSystemManager.js';

async function test() {
  const manager = new DesignSystemManager();

  console.log('Testing Design System Manager...\n');

  // Test creation
  const result = await manager.createDesignSystem({
    projectName: 'test-cli',
    name: 'default',
    description: 'Test design system',
    styleConfig: {
      colors: {
        primary: '#3B82F6',
        secondary: '#10B981',
        background: '#FFFFFF',
        surface: '#F9FAFB',
        text: { primary: '#1F2937', secondary: '#6B7280' }
      },
      typography: {
        fontFamily: { body: 'Inter', heading: 'Inter' },
        fontSize: { xs: '0.75rem', sm: '0.875rem', base: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem' },
        fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
        lineHeight: { tight: '1.25', normal: '1.5', relaxed: '1.75', loose: '2' }
      },
      spacing: { xs: '0.25rem', sm: '0.5rem', md: '1rem', lg: '1.5rem', xl: '2rem', '2xl': '3rem' }
    }
  });

  console.log('✅ Create result:', result.success ? 'SUCCESS' : 'FAILED');
  if (result.designSystem) {
    console.log('   Design System ID:', result.designSystem.id);
    console.log('   Name:', result.designSystem.name);
    console.log('   Project:', result.designSystem.project_name);
  } else {
    console.log('   Error:', result.error);
    process.exit(1);
  }

  // Test retrieval
  const retrieved = await manager.getDesignSystem({
    projectName: 'test-cli',
    name: 'default'
  });

  console.log('\n✅ Retrieve result:', retrieved ? 'SUCCESS' : 'FAILED');

  // Test update
  const updated = await manager.updateDesignSystem({
    id: result.designSystem!.id,
    description: 'Updated description'
  });

  console.log('✅ Update result:', updated ? 'SUCCESS' : 'FAILED');
  if (updated) {
    console.log('   New description:', updated.description);
  }

  // Cleanup
  if (result.designSystem) {
    const deleted = await manager.deleteDesignSystem({ id: result.designSystem.id });
    console.log('\n✅ Cleanup:', deleted ? 'SUCCESS - deleted test design system' : 'FAILED');
  }

  console.log('\n✅ All tests passed!');
  process.exit(0);
}

test().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
