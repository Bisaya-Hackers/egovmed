'use strict';

/** Minimum patient shape safe to return to the citizen client. */
const publicPatient = (p) => ({
  id: p.id,
  firstName: p.firstName,
  middleName: p.middleName,
  lastName: p.lastName,
  suffix: p.suffix,
  sex: p.sex,
  birthDate: p.birthDate,
  email: p.email,
  phone: p.phone,
  nationality: p.nationality,
  identityVerified: !!p.identityVerified,
  benefits: {
    philhealth: !!p.benefits?.philhealth?.active,
    whiteCard: !!p.benefits?.whiteCard?.active,
    sss: !!p.benefits?.sss?.active,
  },
});

module.exports = { publicPatient };
