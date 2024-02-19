import * as yup from "yup";
export const EMAIL_REGX =
  /^(([^<>()\[\]\\.,;:\s@"]+(.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@(([[0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}])|(([a-zA-Z-0-9]+.)+[a-zA-Z]{2,}))$/;
export const loginValidationSchema = yup.object({
  email: yup.string().matches(EMAIL_REGX, "Invalid email address").required("Email is required"),
  password: yup.string().required("Password is required"),
  referral_code: yup.string(),
});
