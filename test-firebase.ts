import { firebaseApp, db, rtdb } from './src/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { ref, set } from 'firebase/database';

async function testFirebase() {
  console.log('Testing Firebase connection...');
  console.log('Project:', firebaseApp.options.projectId);
  
  const testData = {
    test: true,
    timestamp: new Date().toISOString()
  };

  try {
    console.log('Attempting to write to Firestore...');
    const docRef = doc(db, 'boutique_data', 'test_connection');
    await setDoc(docRef, testData);
    console.log('✅ Firestore write successful!');
  } catch (error) {
    console.error('❌ Firestore write failed:', error.message);
  }

  try {
    console.log('Attempting to write to RTDB...');
    const rtdbRef = ref(rtdb, 'boutique_store/test_connection');
    await set(rtdbRef, testData);
    console.log('✅ RTDB write successful!');
  } catch (error) {
    console.error('❌ RTDB write failed:', error.message);
  }

  process.exit(0);
}

testFirebase();
