/**
 * Performance Testing Script
 * 
 * This script helps measure the performance improvements
 * Run in browser console on the people list pages
 */

// Test old vs new endpoint
async function compareEndpoints(token) {
  console.log('🧪 Performance Comparison Test\n');
  
  // Test OLD endpoint (N+1 queries)
  console.log('Testing OLD endpoint with N+1 queries...');
  const oldStart = performance.now();
  
  try {
    const peopleRes = await fetch('/api/people', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const peopleData = await peopleRes.json();
    const people = peopleData.people || [];
    
    const detailPromises = people.slice(0, 10).map(person => 
      fetch(`/api/people/${person.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
    );
    
    await Promise.all(detailPromises);
    
    const oldEnd = performance.now();
    const oldTime = Math.round(oldEnd - oldStart);
    
    console.log(`✅ OLD: ${oldTime}ms for ${people.slice(0, 10).length} people (${people.slice(0, 10).length + 1} requests)`);
  } catch (error) {
    console.error('❌ OLD endpoint failed:', error);
  }
  
  // Test NEW optimized endpoint
  console.log('\nTesting NEW optimized endpoint...');
  const newStart = performance.now();
  
  try {
    const optimizedRes = await fetch('/api/people/with-stats?limit=10', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const optimizedData = await optimizedRes.json();
    const optimizedPeople = optimizedData.people || [];
    
    const newEnd = performance.now();
    const newTime = Math.round(newEnd - newStart);
    
    console.log(`✅ NEW: ${newTime}ms for ${optimizedPeople.length} people (1 request)`);
    
    // Calculate improvement
    console.log('\n📊 Results:');
    console.log(`⚡ Speed improvement: ${Math.round((oldTime - newTime) / oldTime * 100)}%`);
    console.log(`📉 Fewer requests: ${people.slice(0, 10).length} requests eliminated`);
    console.log(`🎯 Time saved: ${oldTime - newTime}ms\n`);
    
  } catch (error) {
    console.error('❌ NEW endpoint failed:', error);
  }
}

// Usage instructions
console.log(`
📋 Performance Test Instructions:

1. Login to the app and get your token from localStorage
2. Run this in console:

   const token = localStorage.getItem('token');
   compareEndpoints(token);

3. Check the results!

Expected improvements:
- 90%+ faster
- 90%+ fewer requests
- Better user experience
`);

// Export for use
if (typeof window !== 'undefined') {
  window.compareEndpoints = compareEndpoints;
}
