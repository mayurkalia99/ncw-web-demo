import React, { useState } from "react";
import { Card, ICardAction } from "./Card";
import { FaEye } from "react-icons/fa";
import { FaEyeLowVision } from "react-icons/fa6";
import { Field, FieldProps, Formik } from "formik";
import { loginValidationSchema } from "../../services/validation";

export const LoginForm = () => {
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);

  const onChangeHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    return setLoginForm((prev) => ({ ...prev, [name]: value }));
  };
  const submit: ICardAction = {
    action: () => console.log("google"),
    label: "Sign In With Google",
  };

  return (
    <Formik
      initialValues={{
        email: "",
        password: "",
      }}
      validationSchema={loginValidationSchema}
      onSubmit={(values) => {
        console.log({ values });
      }}
    >
      <form className="max-w-4xl m-auto">
        <div className="shadow-xl card bg-base-100">
          <div className="gap-6 card-body">
            <h2 className="card-title">Login</h2>
            <Field name="email">
              {({ field, meta }: FieldProps) => (
                <div>
                  <label className="flex items-center gap-2 input input-bordered">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      className="w-4 h-4 opacity-70"
                    >
                      <path d="M2.5 3A1.5 1.5 0 0 0 1 4.5v.793c.026.009.051.02.076.032L7.674 8.51c.206.1.446.1.652 0l6.598-3.185A.755.755 0 0 1 15 5.293V4.5A1.5 1.5 0 0 0 13.5 3h-11Z" />
                      <path d="M15 6.954 8.978 9.86a2.25 2.25 0 0 1-1.956 0L1 6.954V11.5A1.5 1.5 0 0 0 2.5 13h11a1.5 1.5 0 0 0 1.5-1.5V6.954Z" />
                    </svg>
                    <input type="email" {...field} className="bg-transparent grow" placeholder="Enter your Email" />
                  </label>
                  {meta.touched && meta.error && <span className="text-sm text-red-600">{meta.error}</span>}
                </div>
              )}
            </Field>
            <Field name="password">
              {({ field, meta }: FieldProps) => (
                <div>
                  <label className="flex items-center gap-2 input input-bordered">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      className="w-4 h-4 opacity-70"
                    >
                      <path
                        fillRule="evenodd"
                        d="M14 6a4 4 0 0 1-4.899 3.899l-1.955 1.955a.5.5 0 0 1-.353.146H5v1.5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5v-2.293a.5.5 0 0 1 .146-.353l3.955-3.955A4 4 0 1 1 14 6Zm-4-2a.75.75 0 0 0 0 1.5.5.5 0 0 1 .5.5.75.75 0 0 0 1.5 0 2 2 0 0 0-2-2Z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <input
                      type={showPassword ? "text" : "password"}
                      className="bg-transparent grow"
                      {...field}
                      placeholder="Enter your password"
                    />
                    {showPassword ? (
                      <FaEyeLowVision className="cursor-pointer opacity-70" onClick={() => setShowPassword(false)} />
                    ) : (
                      <FaEye className="cursor-pointer opacity-70" onClick={() => setShowPassword(true)} />
                    )}
                  </label>
                  {meta.touched && meta.error && <span className="text-sm text-red-600">{meta.error}</span>}
                </div>
              )}
            </Field>

            <div className="items-center card-actions">
              <button className="text-primary">Forgot Password?</button>
              <button type="submit" className="ml-auto w-36 btn btn-primary">
                {/* {isInProgress && <span className="loading loading-spinner">x</span>} */}
                Submit
              </button>
            </div>
          </div>
        </div>
      </form>
    </Formik>
  );
};
