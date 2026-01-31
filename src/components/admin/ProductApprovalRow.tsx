import { Box, Chip, Button } from "@mui/material";
import { Product } from "../../models/Product";  // ✅ Changed
import {
  authorizeApprove,
  updateProduct,
} from "../../services/productService";  // ✅ Changed
import { useUserStore } from "../../store/userStore";

interface Props {
  product: Product;  // ✅ Changed from project
  refresh(): void;
}

export default function ProductApprovalRow({ product, refresh }: Props) {
  const user = useUserStore((s) => s.user);

  if (!authorizeApprove(user, product)) return null;
  if (product.status !== "Pending") return null;

  function update(status: "Approved" | "Rejected") {
    updateProduct({ ...product, status });
    refresh();
  }

  return (
    <Box display="flex" alignItems="center" gap={2}>
      <Chip label={product.status} size="small" />

      <Button size="small" color="success" onClick={() => update("Approved")}>
        Approve
      </Button>

      <Button size="small" color="error" onClick={() => update("Rejected")}>
        Reject
      </Button>
    </Box>
  );
}
