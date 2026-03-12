import { useMemo } from 'react';
import { useFacilityData } from '../../../app/providers';
import { ResidentCoursePDFConfig } from '../../../types/reportTypes';
import { getResidentCourseData } from './residentCourseDataUtils';

export const useResidentCourseData = (
  residentId: string,
  config: ResidentCoursePDFConfig
) => {
  const { store } = useFacilityData();

  return useMemo(
    () => getResidentCourseData(store, residentId, config),
    [store, residentId, config]
  );
};
