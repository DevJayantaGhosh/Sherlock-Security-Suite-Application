
import { Box, Container } from "@mui/material";
import { motion } from "framer-motion";
import ProjectList from "../components/ProjectList";
import { AppUser } from "../models/User";

const dummyUsers: AppUser[] = [
  { id: "u1", name: "Alice", role: "ProjectDirector" },
  { id: "u2", name: "Bob", role: "SecurityHead" },
  { id: "u3", name: "Chris", role: "ReleaseEngineer" },
];

export default function ProjectPage() {
  return (

    <Box
      sx={{
        pt: 14,
        pb: 15,
        minHeight: "80vh", // keep footer down
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <Container maxWidth="lg">
        
        {/* Fade + Slide Animation Wrapper */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        >
          <ProjectList users={dummyUsers} />

        </motion.div>

      </Container>
    </Box>



  );




  
}
