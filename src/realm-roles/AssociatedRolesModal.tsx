import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownToggle,
  Label,
  Modal,
  ModalVariant,
} from "@patternfly/react-core";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { useAdminClient } from "../context/auth/AdminClient";
import RoleRepresentation from "keycloak-admin/lib/defs/roleRepresentation";
import { KeycloakDataTable } from "../components/table-toolbar/KeycloakDataTable";
import { ListEmptyState } from "../components/list-empty-state/ListEmptyState";
import { CaretDownIcon, FilterIcon } from "@patternfly/react-icons";
import KeycloakAdminClient from "keycloak-admin";

type AliasRendererComponentProps = {
  name?: string;
  containerId?: string;
  filterType: string;
  adminClient: KeycloakAdminClient;
  id: string;
};

const AliasRendererComponent = ({
  name,
  containerId,
  filterType,
  adminClient,
  id,
}: AliasRendererComponentProps) => {
  const [containerName, setContainerName] = useState<string>("");

  useEffect(() => {
    adminClient.clients
      .findOne({ id: containerId! })
      .then((client) => setContainerName(client.clientId as string));
  }, [containerId]);

  if (filterType === "roles") {
    return <>{name}</>;
  }

  if (filterType === "clients") {
    return (
      <>
        {containerId && (
          <Label color="blue" key={`label-${id}`}>
            {containerName}
          </Label>
        )}{" "}
        {name}
      </>
    );
  }

  return null;
};

export type AssociatedRolesModalProps = {
  open: boolean;
  toggleDialog: () => void;
  onConfirm: (newReps: RoleRepresentation[]) => void;
  existingCompositeRoles: RoleRepresentation[];
};

const attributesToArray = (attributes: { [key: string]: string }): any => {
  if (!attributes || Object.keys(attributes).length == 0) {
    return [
      {
        key: "",
        value: "",
      },
    ];
  }
  return Object.keys(attributes).map((key) => ({
    key: key,
    value: attributes[key],
  }));
};

export const AssociatedRolesModal = (props: AssociatedRolesModalProps) => {
  const { t } = useTranslation("roles");
  const form = useForm<RoleRepresentation>({ mode: "onChange" });
  const [name, setName] = useState("");
  const adminClient = useAdminClient();
  const [selectedRows, setSelectedRows] = useState<RoleRepresentation[]>([]);
  const [allClientRoles, setAllClientRoles] = useState<RoleRepresentation[]>(
    []
  );

  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [filterType, setFilterType] = useState("roles");
  const tableRefresher = React.useRef<() => void>();

  const { id } = useParams<{ id: string }>();

  const alphabetize = (rolesList: RoleRepresentation[]) => {
    return rolesList.sort((r1, r2) => {
      const r1Name = r1.name?.toUpperCase();
      const r2Name = r2.name?.toUpperCase();
      if (r1Name! < r2Name!) {
        return -1;
      }
      if (r1Name! > r2Name!) {
        return 1;
      }

      return 0;
    });
  };

  const loader = async () => {
    const allRoles = await adminClient.roles.find();
    const existingAdditionalRoles = await adminClient.roles.getCompositeRoles({
      id,
    });

    return alphabetize(allRoles).filter((role: RoleRepresentation) => {
      return (
        existingAdditionalRoles.find(
          (existing: RoleRepresentation) => existing.name === role.name
        ) === undefined && role.name !== name
      );
    });
  };

  const AliasRenderer = (role: RoleRepresentation) => {
    return (
      <>
        <AliasRendererComponent
          id={id}
          name={role.name}
          adminClient={adminClient}
          filterType={filterType}
          containerId={role.containerId}
        />
      </>
    );
  };

  const clientRolesLoader = async () => {
    const clients = await adminClient.clients.find();

    const clientIdArray = clients.map((client) => client.id);

    let rolesList: RoleRepresentation[] = [];
    for (const id of clientIdArray) {
      const clientRolesList = await adminClient.clients.listRoles({
        id: id as string,
      });
      rolesList = [...rolesList, ...clientRolesList];
    }
    const existingAdditionalRoles = await adminClient.roles.getCompositeRoles({
      id,
    });

    setAllClientRoles(rolesList);
    console.log(allClientRoles);

    return alphabetize(rolesList).filter((role: RoleRepresentation) => {
      return (
        existingAdditionalRoles.find(
          (existing: RoleRepresentation) => existing.name === role.name
        ) === undefined && role.name !== name
      );
    });
  };

  React.useEffect(() => {
    tableRefresher.current && tableRefresher.current();
  }, [filterType]);

  useEffect(() => {
    (async () => {
      if (id) {
        const fetchedRole = await adminClient.roles.findOneById({ id });
        setName(fetchedRole.name!);
        setupForm(fetchedRole);
      } else {
        setName(t("createRole"));
      }
    })();
  }, []);

  const setupForm = (role: RoleRepresentation) => {
    Object.entries(role).map((entry) => {
      if (entry[0] === "attributes") {
        form.setValue(entry[0], attributesToArray(entry[1]));
      } else {
        form.setValue(entry[0], entry[1]);
      }
    });
  };

  const onFilterDropdownToggle = () => {
    setIsFilterDropdownOpen(!isFilterDropdownOpen);
  };

  const onFilterDropdownSelect = (filterType: string) => {
    if (filterType == "roles") {
      setFilterType("clients");
    }
    if (filterType == "clients") {
      setFilterType("roles");
    }
    setIsFilterDropdownOpen(!isFilterDropdownOpen);
  };

  const setRefresher = (refresher: () => void) => {
    tableRefresher.current = refresher;
  };

  return (
    <Modal
      title={t("roles:associatedRolesModalTitle", { name })}
      isOpen={props.open}
      onClose={props.toggleDialog}
      variant={ModalVariant.large}
      actions={[
        <Button
          key="add"
          id="add-associated-roles-button"
          variant="primary"
          isDisabled={!selectedRows?.length}
          onClick={() => {
            props.toggleDialog();
            props.onConfirm(selectedRows);
          }}
        >
          {t("common:add")}
        </Button>,
        <Button
          key="cancel"
          variant="link"
          onClick={() => {
            props.toggleDialog();
          }}
        >
          {t("common:cancel")}
        </Button>,
      ]}
    >
      <KeycloakDataTable
        key="role-list-modal"
        loader={filterType == "roles" ? loader : clientRolesLoader}
        ariaLabelKey="roles:roleList"
        searchPlaceholderKey="roles:searchFor"
        setRefresher={setRefresher}
        searchTypeComponent={
          <Dropdown
            onSelect={() => onFilterDropdownSelect(filterType)}
            data-cy="filter-type-dropdown"
            toggle={
              <DropdownToggle
                id="toggle-id-9"
                onToggle={onFilterDropdownToggle}
                toggleIndicator={CaretDownIcon}
                icon={<FilterIcon />}
              >
                Filter by {filterType}
              </DropdownToggle>
            }
            isOpen={isFilterDropdownOpen}
            dropdownItems={[
              <DropdownItem
                data-cy="filter-type-dropdown-item"
                key="filter-type"
              >
                {filterType == "roles"
                  ? t("filterByClients")
                  : t("filterByRoles")}{" "}
              </DropdownItem>,
            ]}
          />
        }
        canSelectAll
        // isPaginated
        onSelect={(rows) => {
          setSelectedRows([...rows]);
        }}
        columns={[
          {
            name: "name",
            displayKey: "roles:roleName",
            cellRenderer: AliasRenderer,
          },
          {
            name: "description",
            displayKey: "common:description",
          },
        ]}
        emptyState={
          <ListEmptyState
            hasIcon={true}
            message={t("noRolesInThisRealm")}
            instructions={t("noRolesInThisRealmInstructions")}
            primaryActionText={t("createRole")}
            // onPrimaryAction={goToCreate}
          />
        }
      />
    </Modal>
  );
};
