import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';

export const findAndCreatePools = async () => {
  const submissionsRef = collection(db, 'submissions');
  const q = query(
    submissionsRef, 
    where('status', '==', 'pending_pickup')
  );

  const snapshot = await (async () => {
    try {
      return await getDocs(q);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'submissions');
      return { docs: [] } as any;
    }
  })();
  const submissions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

  if (submissions.length === 0) return [];

  // Simple pooling logic: Group all matching submissions into one pool for now
  // In a real app, we'd use k-means or radius-based grouping
  // Here we just grab the first cluster we find within 15km of the first item
  const first = submissions[0];
  const radiusKm = 15;
  
  const poolMembers = submissions.filter(s => {
    const dist = getDistance(first.location.lat, first.location.lng, s.location.lat, s.location.lng);
    return dist <= radiusKm;
  });

  if (poolMembers.length < 1) return []; // Allow single-entry loops for demo

  const batch = writeBatch(db);
  const poolRef = await (async () => {
    try {
      return await addDoc(collection(db, 'pools'), {
        status: 'active',
        createdAt: Timestamp.now(),
        submissionIds: poolMembers.map(m => m.id),
        locations: poolMembers.map(m => ({
          lat: m.location.lat,
          lng: m.location.lng,
          label: m.crop_type
        })),
        optimizedPath: [], // Will be filled by Maps API in view
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'pools');
      throw error;
    }
  })();

  poolMembers.forEach(m => {
    batch.update(doc(db, 'submissions', m.id), {
      status: 'pooled',
      poolId: poolRef.id
    });
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'batch-update-submissions');
  }
  return { poolId: poolRef.id, members: poolMembers };
};

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return R * c; 
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}
