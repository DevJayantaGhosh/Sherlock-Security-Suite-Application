import toast from "react-hot-toast";

export const toastAdd = (msg="Created successfully") =>
  toast.success(msg);

export const toastApprove = () =>
  toast.success("Project Approved");

export const toastReject = () =>
  toast.error("Project Rejected");

export const toastDelete = () =>
  toast.success("Project Deleted");

export const toastUpdate = () =>
  toast.success("Project Updated");

export const toastRelease = () =>
  toast.success("Project Released");
